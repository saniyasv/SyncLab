import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRooms } from '@/context/RoomContext';
import { supabase } from '@/lib/supabase';
import type { Room, RoomMember, Message, WhiteboardShape } from '@/types';
import type { ApiError } from '@/types';
import Editor from '@monaco-editor/react';
import {
Stage,
Layer,
Rect,
Circle,
Line as KonvaLine,
Text as KonvaText,
Transformer,
} from "react-konva";
import type Konva from 'konva';
import {
  ArrowLeft, Users, Code2, PenTool, MessageSquare, Send,
  Square, Circle as CircleIcon, Minus, Type as TypeIcon, Pencil,
  Trash2, Eraser, Crown,
} from 'lucide-react';

type Tab = 'code' | 'whiteboard';
type Tool = 'select' | 'rect' | 'circle' | 'line' | 'text' | 'pen' | 'eraser';

const LANG_MAP: Record<string, string> = {
  javascript: 'javascript', typescript: 'typescript', python: 'python',
  java: 'java', cpp: 'cpp', html: 'html', css: 'css', go: 'go', rust: 'rust', json: 'json',
};

export default function WorkspacePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const { getRoom, getMembers, getMessages, startSession, endSession } = useRooms();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [code, setCode] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);
  const [shapes, setShapes] = useState<WhiteboardShape[]>([]);
  const [tab, setTab] = useState<Tab>('code');
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<Tool>('select');
  const [penPoints, setPenPoints] = useState<number[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const isRemoteUpdate = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  /* ---- responsive stage sizing ---- */
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setStageSize({ width: rect.width, height: rect.height });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [tab]);

  /* ---- load initial data ---- */
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const [r, m, msgs] = await Promise.all([getRoom(roomId), getMembers(roomId), getMessages(roomId)]);
        setRoom(r);
        setMembers(m);
        setMessages(msgs);

        const { data: files } = await supabase
          .from('room_files').select('id, content').eq('room_id', roomId)
          .order('created_at', { ascending: true }).limit(1);
        if (files && files.length > 0) {
          setFileId(files[0].id);
          setCode(files[0].content || '');
        }

        const { data: shapeData } = await supabase
          .from('whiteboard_shapes')
          .select('id, room_id, type, props, created_by, updated_at, created_at')
          .eq('room_id', roomId);
        if (shapeData) {
          setShapes(shapeData.map((s) => ({
            ...s,
            props: typeof s.props === 'string' ? JSON.parse(s.props) : s.props,
          })) as WhiteboardShape[]);
        }
      } catch (err) {
        setError((err as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, getRoom, getMembers, getMessages]);

  /* ---- session tracking ---- */
  useEffect(() => {
    if (!roomId || !user || loading) return;
    startSession(roomId).then((id) => { sessionId.current = id; });
    return () => {
      if (sessionId.current) endSession(sessionId.current);
    };
  }, [roomId, user, loading, startSession, endSession]);

  /* ---- real-time subscriptions ---- */
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          (async () => {
            const { data: profile } = await supabase
              .from('profiles').select('name, avatar_url').eq('id', newMsg.user_id as string).maybeSingle();
            setMessages((prev) => [...prev, {
              id: newMsg.id as string, room_id: newMsg.room_id as string, user_id: newMsg.user_id as string,
              user_name: profile?.name || 'Unknown', user_avatar: profile?.avatar_url || null,
              content: newMsg.content as string, created_at: newMsg.created_at as string,
            } as Message]);
          })();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whiteboard_shapes', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newShape = payload.new as Record<string, unknown>;
          setShapes((prev) => {
            if (prev.some((s) => s.id === newShape.id)) return prev;
            return [...prev, {
              id: newShape.id as string, room_id: newShape.room_id as string,
              type: newShape.type as WhiteboardShape['type'],
              props: typeof newShape.props === 'string' ? JSON.parse(newShape.props) : newShape.props,
              created_by: newShape.created_by as string, updated_at: newShape.updated_at as string,
            } as WhiteboardShape];
          });
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'whiteboard_shapes', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const oldShape = payload.old as Record<string, unknown>;
          setShapes((prev) => prev.filter((s) => s.id !== oldShape.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  /* ---- scroll chat ---- */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ---- code editor handlers ---- */
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    const content = value || '';
    setCode(content);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (fileId) {
      saveTimeout.current = setTimeout(async () => {
        await supabase.from('room_files').update({ content }).eq('id', fileId);
      }, 1000);
    }
  }, [fileId]);

  /* ---- chat handlers ---- */
  async function sendChat(e: React.FormEvent) {
  e.preventDefault();

  if (!chatInput.trim() || !roomId || !user) return;

  const content = chatInput.trim();

  setChatInput("");

  const tempMessage: Message = {
    id: crypto.randomUUID(),
    room_id: roomId,
    user_id: user.id,
    user_name: user.user_metadata?.name || "You",
    user_avatar: null,
    content,
    created_at: new Date().toISOString(),
  };

  setMessages((prev) => [...prev, tempMessage]);

  const { data, error } = await supabase
  .from("messages")
  .insert({
    room_id: roomId,
    user_id: user.id,
    content,
  })
  .select();

console.log("Inserted:", data);
console.log("Error:", error);

if (!error && data) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single();

  setMessages((prev) => [
    ...prev,
    {
      id: data[0].id,
      room_id: roomId,
      user_id: user.id,
      user_name: profile?.name || "You",
      user_avatar: profile?.avatar_url || null,
      content,
      created_at: data[0].created_at,
    },
  ]);
}

  if (error) {
    setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    setChatInput(content);
  }
}

  /* ---- whiteboard handlers ---- */
  function persistShape(shape: WhiteboardShape) {
    supabase.from('whiteboard_shapes').insert({
      id: shape.id, room_id: shape.room_id, type: shape.type,
      props: shape.props, created_by: shape.created_by,
    }).then();
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool === 'select' || tool === 'eraser') return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos || !roomId || !user) return;

    if (tool === 'rect') {
      const shape: WhiteboardShape = {
        id: crypto.randomUUID(), room_id: roomId, type: 'rect',
        props: { x: pos.x, y: pos.y, width: 100, height: 70, fill: '#3b82f6', stroke: '#60a5fa' },
        created_by: user.id, updated_at: new Date().toISOString(),
      };
      setShapes((prev) => [...prev, shape]);
      persistShape(shape);
    } else if (tool === 'circle') {
      const shape: WhiteboardShape = {
        id: crypto.randomUUID(), room_id: roomId, type: 'circle',
        props: { x: pos.x, y: pos.y, radius: 45, fill: '#8b5cf6', stroke: '#a78bfa' },
        created_by: user.id, updated_at: new Date().toISOString(),
      };
      setShapes((prev) => [...prev, shape]);
      persistShape(shape);
    } else if (tool === 'text') {
      const text = prompt('Enter text:');
      if (!text) return;
      const shape: WhiteboardShape = {
        id: crypto.randomUUID(), room_id: roomId, type: 'text',
        props: { x: pos.x, y: pos.y, text, fontSize: 20, fill: '#e2e8f0' },
        created_by: user.id, updated_at: new Date().toISOString(),
      };
      setShapes((prev) => [...prev, shape]);
      persistShape(shape);
    }
  }

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool !== 'pen' && tool !== 'line') return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setPenPoints([pos.x, pos.y]);
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool !== 'pen' || penPoints.length === 0) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setPenPoints((prev) => [...prev, pos.x, pos.y]);
  }

  function handleStageMouseUp() {
    if (tool !== 'pen' || penPoints.length < 4 || !roomId || !user) { setPenPoints([]); return; }
    const shape: WhiteboardShape = {
      id: crypto.randomUUID(), room_id: roomId, type: 'pen',
      props: { points: penPoints, stroke: '#60a5fa', strokeWidth: 3 },
      created_by: user.id, updated_at: new Date().toISOString(),
    };
    setShapes((prev) => [...prev, shape]);
    persistShape(shape);
    setPenPoints([]);
  }

  async function clearWhiteboard() {
    if (!confirm('Clear the entire whiteboard?')) return;
    setShapes([]);
    if (roomId) await supabase.from('whiteboard_shapes').delete().eq('room_id', roomId);
  }

  async function eraseShape(shapeId: string) {
    setShapes((prev) => prev.filter((s) => s.id !== shapeId));
    await supabase.from('whiteboard_shapes').delete().eq('id', shapeId);
  }

  function handleShapeClick(shapeId: string) {
    if (tool === 'eraser') eraseShape(shapeId);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
        <div className="glass-card rounded-xl p-8 text-center max-w-md">
          <p className="text-red-400 mb-4">{error || 'Room not found'}</p>
          <Link to="/dashboard" className="text-blue-400 hover:text-blue-300">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const tools: { id: Tool; icon: typeof Square; label: string }[] = [
    { id: 'select', icon: Square, label: 'Select' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: CircleIcon, label: 'Circle' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'text', icon: TypeIcon, label: 'Text' },
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c14] flex flex-col">
      {/* top bar */}
      <header className="bg-[#0a0c14]/80 backdrop-blur-xl border-b border-white/5 px-5 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to={`/room/${room.id}`} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition">
            <ArrowLeft size={16} /><span className="hidden sm:inline">Room</span>
          </Link>
          <span className="text-slate-700">/</span>
          <h1 className="font-display text-sm font-semibold text-white truncate max-w-[200px]">{room.name}</h1>
          <span className="text-xs font-mono-code text-slate-500 px-2 py-0.5 rounded-md bg-white/5 hidden sm:inline">{room.language}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {members.slice(0, 4).map((m) => (
              <div key={m.id} title={m.user_name}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white border-2 border-[#0a0c14]">
                {m.user_name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-300 border-2 border-[#0a0c14]">
                +{members.length - 4}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* main split */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          {/* tabs */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 h-11 flex-shrink-0">
            <div className="flex items-center gap-1">
              <button onClick={() => setTab('code')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  tab === 'code' ? 'text-white bg-white/8' : 'text-slate-400 hover:text-white'}`}>
                <Code2 size={15} /><span className="hidden sm:inline">Code</span>
              </button>
              <button onClick={() => setTab('whiteboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  tab === 'whiteboard' ? 'text-white bg-white/8' : 'text-slate-400 hover:text-white'}`}>
                <PenTool size={15} /><span className="hidden sm:inline">Whiteboard</span>
              </button>
            </div>

            {tab === 'whiteboard' && (
              <div className="flex items-center gap-1">
                {tools.map((t) => (
                  <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                    className={`p-1.5 rounded-md transition ${
                      tool === t.id ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                    <t.icon size={16} />
                  </button>
                ))}
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={clearWhiteboard} title="Clear all"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {/* content */}
          <div className="flex-1 min-h-0" ref={containerRef}>
            {tab === 'code' ? (
              <Editor
                height="100%"
                language={LANG_MAP[room.language] || 'javascript'}
                value={code}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            ) : (
              <div className="w-full h-full bg-[#0d1018] relative overflow-hidden">
                <Stage
                  width={stageSize.width}
                  height={stageSize.height}
                  onClick={handleStageClick}
                  onMouseDown={handleStageMouseDown}
                  onMouseMove={handleStageMouseMove}
                  onMouseUp={handleStageMouseUp}
                  className="cursor-crosshair"
                >
                  <Layer>
                    {shapes.map((s) => {
  if (s.type === "rect")
    return (
      <Rect
        key={s.id}
        x={Number(s.props.x)}
        y={Number(s.props.y)}
        width={Number(s.props.width)}
        height={Number(s.props.height)}
        fill={String(s.props.fill)}
        stroke={String(s.props.stroke)}
        draggable={tool === "select"}
        onClick={() => handleShapeClick(s.id)}
        onDragEnd={async (e) => {
          const props = {
            ...s.props,
            x: e.target.x(),
            y: e.target.y(),
          };

          setShapes((prev) =>
            prev.map((shape) =>
              shape.id === s.id ? { ...shape, props } : shape
            )
          );

          await supabase
            .from("whiteboard_shapes")
            .update({ props })
            .eq("id", s.id);
        }}
  onMouseDown={() => handleShapeClick(s.id)}
onTap={() => handleShapeClick(s.id)}
/>
                      );
                       
 if (s.type === "circle")
  return (
    <Circle
      key={s.id}
      x={Number(s.props.x)}
      y={Number(s.props.y)}
      radius={Number(s.props.radius)}
      fill={String(s.props.fill)}
      stroke={String(s.props.stroke)}
      draggable={tool === "select"}
      onClick={() => handleShapeClick(s.id)}
      onMouseDown={() => handleShapeClick(s.id)}
      onTap={() => handleShapeClick(s.id)}
      onDragEnd={async (e) => {
        const props = {
          ...s.props,
          x: e.target.x(),
          y: e.target.y(),
        };

        setShapes((prev) =>
          prev.map((shape) =>
            shape.id === s.id ? { ...shape, props } : shape
          )
        );

        await supabase
          .from("whiteboard_shapes")
          .update({ props })
          .eq("id", s.id);
      }}
    />
  );
                      if (s.type === 'text') return (
                       <KonvaText
  x={Number(s.props.x)}
  y={Number(s.props.y)}
  text={String(s.props.text)}
  fontSize={Number(s.props.fontSize)}
  fill={String(s.props.fill)}
  draggable={tool === "select"}

onClick={() => {
  if (tool === "select") setSelectedId(s.id);
  if (tool === "eraser") handleShapeClick(s.id);
}}

onTap={() => {
  if (tool === "select") setSelectedId(s.id);
  if (tool === "eraser") handleShapeClick(s.id);
}}
  onDragEnd={async (e) => {
    const props = {
      ...s.props,
      x: e.target.x(),
      y: e.target.y(),
    };

    setShapes((prev) =>
      prev.map((shape) =>
        shape.id === s.id ? { ...shape, props } : shape
      )
    );

    await supabase
      .from("whiteboard_shapes")
      .update({ props })
      .eq("id", s.id);
  }}
  onMouseDown={() => handleShapeClick(s.id)}
onTap={() => handleShapeClick(s.id)}
/>
                      );
                      if (s.type === 'pen' || s.type === 'line') return (
                        <KonvaLine key={s.id}
                          points={s.props.points as number[]} stroke={String(s.props.stroke)}
                          strokeWidth={Number(s.props.strokeWidth)} lineCap="round" lineJoin="round"
                          onClick={() => handleShapeClick(s.id)} />
                      );
                      return null;
                    })}
                    {penPoints.length > 2 && (
                      <KonvaLine points={penPoints} stroke="#60a5fa" strokeWidth={3} lineCap="round" lineJoin="round" />
                    )}
                  </Layer>
                </Stage>
              </div>
            )}
          </div>
        </div>

        {/* sidebar: chat + members */}
        <aside className="w-[340px] sm:w-[384px] flex-shrink-0 border-l border-white/5 flex flex-col bg-[#0b0d15]">
          <div className="border-b border-white/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
              <Users size={16} /> Members ({members.length})
            </h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
                    {m.user_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-300 flex-1 truncate">{m.user_name}</span>
                  {m.role === 'owner' && <Crown size={13} className="text-amber-400" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare size={16} /> Chat
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-600 text-center mt-8">No messages yet. Start the conversation!</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.user_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                        {msg.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        <span className="text-xs text-slate-500 mb-0.5">{isMine ? 'You' : msg.user_name}</span>
                        <div className={`px-3 py-2 rounded-lg text-sm ${
                          isMine ? 'bg-blue-500/20 text-blue-100' : 'bg-white/5 text-slate-200'}`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-slate-600 mt-0.5">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="p-3 border-t border-white/5 flex gap-2">
              <input type="text" className="input-field !py-2 !text-sm" placeholder="Type a message…"
                value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
              <button type="submit" disabled={!chatInput.trim()}
                className="px-3 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition disabled:opacity-40 flex items-center justify-center">
                <Send size={16} />
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
