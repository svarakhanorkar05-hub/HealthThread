import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Trash2,
  AlertTriangle,
  Bot,
  User,
  HelpCircle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  FileText,
  Pill,
  HeartPulse,
  Activity,
  CheckCircle,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ToastContainer, useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import {
  askHealthAssistant,
  testGeminiConnection,
  loadChatMessages,
  saveChatMessage,
  clearChatHistory,
  type GeminiTestResult,
} from '@/lib/assistant';
import type { AIChatMessage } from '@/types/database';

const SUGGESTED_PROMPTS = [
  'Summarize my medical history.',
  'What medications am I currently taking?',
  'Explain my latest blood test report.',
  'Show me my vaccination history.',
  'What does this medical term mean?',
  'Summarize my previous doctor visits.',
];

const WELCOME_MESSAGE: AIChatMessage = {
  id: 'welcome',
  user_id: 'system',
  role: 'assistant',
  content:
    "Hi! I'm your HealthThread AI Assistant. I can help you understand your health records, medical reports, medications, and general health-related questions.\n\n" +
    "Feel free to ask questions about your stored timeline, lab values, or pick from the suggested topics below.",
  created_at: new Date().toISOString(),
};

export function AIAssistantPage() {
  const { user, profile } = useAuth();
  const { toasts, success, error, dismiss } = useToast();

  const [messages, setMessages] = useState<AIChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Gemini Test state
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testResult, setTestResult] = useState<GeminiTestResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat history from database on mount
  useEffect(() => {
    if (!user) return;
    setLoadingHistory(true);
    loadChatMessages(user.id)
      .then((history) => {
        if (history.length > 0) {
          setMessages([WELCOME_MESSAGE, ...history]);
        }
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [user]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || !user || loading) return;

    setInputText('');

    // Append user message to local state
    const tempUserMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      // Save user message to database
      await saveChatMessage(user.id, 'user', query);

      // Call AI Assistant via Edge Function
      const response = await askHealthAssistant(
        user.id,
        query,
        messages.filter((m) => m.id !== 'welcome')
      );

      const aiMsgContent = response.reply;

      // Append assistant message
      const tempAiMsg: AIChatMessage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'assistant',
        content: aiMsgContent,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempAiMsg]);

      // Save AI message to database
      await saveChatMessage(user.id, 'assistant', aiMsgContent);
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to generate response');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    try {
      await clearChatHistory(user.id);
      setMessages([WELCOME_MESSAGE]);
      success('Conversation cleared.');
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to clear conversation');
    } finally {
      setConfirmClearOpen(false);
    }
  };

  const runGeminiTest = async () => {
    setTestingGemini(true);
    setTestResult(null);
    setTestModalOpen(true);

    try {
      const res = await testGeminiConnection();
      setTestResult(res);
      if (res.success) {
        success('Gemini Edge Function verified successfully!');
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test Gemini connection',
      });
    } finally {
      setTestingGemini(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] max-w-5xl mx-auto animate-fade-in space-y-3">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-teal-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                AI Health Assistant
              </h1>
              <span className="badge bg-teal-50 text-teal-700 border border-teal-200 text-[10px]">
                Gemini 2.0 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Personalized insights based on your medical records and documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Temporary test button to verify Gemini connection */}
          <button
            type="button"
            onClick={runGeminiTest}
            className="btn btn-secondary text-xs px-2.5 py-1.5"
            title="Verify Gemini Edge Function connection"
          >
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden sm:inline">Test Gemini</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            disabled={messages.length <= 1}
            className="btn btn-ghost text-xs px-2.5 py-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-40"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Medical Safety Disclaimer Banner */}
      <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shrink-0">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Important Safety Notice:</strong> The HealthThread AI Assistant is an informational tool to help you navigate and understand your personal records. It does not provide medical diagnoses or prescriptions. If you have an acute emergency, call <strong>911</strong> or your local emergency services immediately.
        </p>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id || index}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-teal-700 text-white'
                    : 'bg-cream-200 text-teal-800 border border-teal-200'
                }`}
              >
                {isUser ? (
                  (profile?.full_name || 'U').charAt(0).toUpperCase()
                ) : (
                  <Sparkles className="w-4 h-4 text-teal-700" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${
                  isUser
                    ? 'bg-teal-700 text-white rounded-tr-none'
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                <div
                  className={`text-[10px] mt-1.5 ${
                    isUser ? 'text-teal-200 text-right' : 'text-slate-400 text-left'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading / Typing indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-cream-200 text-teal-800 border border-teal-200 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-teal-700" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span>Analyzing health records and communicating with Gemini...</span>
            </div>
          </div>
        )}

        {/* Suggested Prompts for First-time / Low message count */}
        {messages.length <= 2 && !loading && (
          <div className="pt-4 space-y-2">
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Suggested questions:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="text-left p-3 rounded-xl bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-300 text-xs text-slate-700 transition-all font-medium flex items-center justify-between group shadow-sm"
                >
                  <span className="line-clamp-1">{prompt}</span>
                  <span className="text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <div className="card p-3 shadow-card shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your medications, doctor visits, blood tests, or health timeline (Enter to send, Shift+Enter for new line)..."
            rows={2}
            className="input resize-none py-2 text-sm max-h-28 scrollbar-thin"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="btn btn-primary px-4 py-3 shrink-0 shadow-sm"
            title="Send Message"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Clear Confirmation Modal */}
      <Modal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Clear conversation history?"
        maxWidth="max-w-sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          This will delete your current conversation history. Your stored medical records and documents will remain safe and unaffected.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmClearOpen(false)} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={handleClearHistory} className="btn-danger flex-1">
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>
      </Modal>

      {/* Temporary Gemini Connection Test Modal */}
      <Modal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Gemini Edge Function Verification"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 py-1">
          {testingGemini ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-medium text-slate-900">
                Calling Edge Function `health-assistant`...
              </p>
              <p className="text-xs text-slate-500">
                Validating Supabase JWT session, retrieving secret, and testing Gemini response.
              </p>
            </div>
          ) : testResult ? (
            <div className="space-y-3">
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-sage-50 border-sage-200 text-sage-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-semibold text-sm">
                    {testResult.success
                      ? 'Gemini Connection Verified!'
                      : 'Connection Test Notice'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed">
                    {testResult.success
                      ? `Successfully connected to Gemini API using model "${testResult.model || 'gemini-2.0-flash'}".`
                      : testResult.error}
                  </p>
                </div>
              </div>

              {testResult.reply && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Gemini Live Response:
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap font-sans">
                    {testResult.reply}
                  </p>
                </div>
              )}

              {!testResult.success && (
                <div className="p-3 bg-slate-50 rounded-xl border text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-slate-800">Deployment checklist for Edge Function:</p>
                  <p>1. Deploy the function using the Supabase CLI:</p>
                  <code className="block bg-white p-2 rounded border font-mono text-[11px] text-teal-800">
                    supabase functions deploy health-assistant
                  </code>
                  <p>2. Ensure your Gemini API secret is set in Supabase:</p>
                  <code className="block bg-white p-2 rounded border font-mono text-[11px] text-teal-800">
                    supabase secrets set GEMINI_API_KEY=your_key
                  </code>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="btn btn-primary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
