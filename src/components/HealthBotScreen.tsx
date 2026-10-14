import React, { useState, useRef, useEffect } from 'react';
import { DonorProfile, ChatMessage } from '../types';

interface HealthBotScreenProps {
  donor: DonorProfile;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-0',
    role: 'bot',
    text: 'Namaste! I am BloodBot, your assistant for general blood donation information. You can ask me in English, Hindi, or Hinglish about eligibility, iron diet, or donation intervals.\n\n⚠️ This is not medical advice, please ask a doctor.',
    timestamp: 'Just now',
    language: 'hinglish',
  },
];

export const HealthBotScreen: React.FC<HealthBotScreenProps> = ({ donor }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'hinglish'>('hinglish');
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.0-flash-exp:free');
  const [isLoading, setIsLoading] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    setInputText('');

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: 'Just now',
      language: selectedLanguage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          language: selectedLanguage,
          model: selectedModel,
          donorProfile: {
            name: donor.name,
            bloodGroup: donor.bloodGroup,
            weight: donor.weight,
            hb: donor.hemoglobin,
          },
        }),
      });

      const data = await res.json();
      const botReply =
        data.reply ||
        'Blood donors must ensure proper hydration and balanced nutrition. Please check with an on-duty medical officer before your donation.';

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: botReply,
        timestamp: 'Just now',
        language: selectedLanguage,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text:
          selectedLanguage === 'hi'
            ? 'रक्तदान से पूर्व 500 मिली पानी पिएं और संतुलित भोजन लें। अस्पताल स्टॉक के लिए Hospital Inventory टैब देखें।\n\n⚠️ This is not medical advice, please ask a doctor.'
            : selectedLanguage === 'hinglish'
            ? 'Donation se pehle khoob paani piyein aur poshtik khana khayein. Hospital stock ke liye Inventory tab dekhein.\n\n⚠️ This is not medical advice, please ask a doctor.'
            : 'Stay well-hydrated with water and eat a healthy meal before donating. For hospital stock, check the Hospital Inventory tab.\n\n⚠️ This is not medical advice, please ask a doctor.',
        timestamp: 'Just now',
        language: selectedLanguage,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicToggle = () => {
    setIsMicActive(!isMicActive);
    if (!isMicActive) {
      setInputText('Can I donate blood if I have low hemoglobin?');
    }
  };

  const handleLangChange = (lang: 'en' | 'hi' | 'hinglish') => {
    setSelectedLanguage(lang);
    let greeting = '';
    if (lang === 'en') {
      greeting = `Hello ${donor.name}! Feel free to ask general blood donation questions regarding eligibility, waiting intervals, or dietary tips.\n\n⚠️ This is not medical advice, please ask a doctor.`;
    } else if (lang === 'hi') {
      greeting = `नमस्ते ${donor.name}! सामान्य रक्तदान पात्रता, अंतराल या हीमोग्लोबिन आहार संबंधी कोई भी प्रश्न पूछें।\n\n⚠️ This is not medical advice, please ask a doctor.`;
    } else {
      greeting = `Namaste ${donor.name}! Aap voluntary blood donation, eligibility ya hemoglobin diet se related general sawal pooch sakte hain.\n\n⚠️ This is not medical advice, please ask a doctor.`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'bot',
        text: greeting,
        timestamp: 'Just now',
        language: lang,
      },
    ]);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 gap-4">
      {/* Header Bar */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#b70011] flex items-center justify-center border border-red-100 flex-shrink-0">
              <span className="material-symbols-outlined text-[24px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display font-bold text-[16px] text-slate-900">BloodBot Clinical AI</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  ⚡ 100% Free
                </span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-[10px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none"
                >
                  <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
                  <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                  <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 72B (Free)</option>
                  <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                  <option value="zero-cost-clinical-engine">Offline Free Engine</option>
                </select>
              </div>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['en', 'hi', 'hinglish'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleLangChange(lang)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  selectedLanguage === lang
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'Hinglish'}
              </button>
            ))}
          </div>
        </div>

        {/* Emergency SOS Banner */}
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-red-900 font-semibold">
            <span className="material-symbols-outlined text-[18px] text-[#b70011]">emergency</span>
            <span>Emergency Need? Dial 112 / 108</span>
          </div>
          <a
            href="tel:112"
            className="px-2.5 py-1 bg-[#b70011] text-white rounded-lg font-bold text-[11px] shadow-xs hover:bg-red-700"
          >
            Call 112
          </a>
        </div>
      </section>

      {/* Suggested Topic Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          'Can I donate after tattoo?',
          'Hemoglobin kaise badhaye?',
          'What to eat before donation?',
          'Interval between donations?',
          'Can a diabetic donate blood?',
        ].map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => handleSend(topic)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap transition-colors shadow-xs"
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <section className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-3 min-h-[420px] max-h-[600px] overflow-y-auto">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-[#b70011] text-white flex items-center justify-center flex-shrink-0 text-[11px] shadow-xs mt-0.5">
                  🤖
                </div>
              )}
              <div
                className={`p-3 rounded-2xl text-[13px] leading-relaxed max-w-[85%] ${
                  isUser
                    ? 'bg-[#b70011] text-white rounded-tr-none shadow-xs'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <span
                  className={`text-[10px] mt-1.5 block ${
                    isUser ? 'text-white/70 text-right' : 'text-slate-400'
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 pl-9 text-[12px] text-slate-500 animate-pulse">
            <span className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
            <span>BloodBot is consulting clinical guidelines...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      {/* Input Box with Voice Mic */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          type="button"
          onClick={handleMicToggle}
          title="Voice Dictation"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isMicActive
              ? 'bg-red-100 text-[#b70011] ring-2 ring-red-400'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[21px]">
            {isMicActive ? 'mic_active' : 'mic'}
          </span>
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={
            selectedLanguage === 'hi'
              ? 'रक्तदान से जुड़ा कोई भी प्रश्न पूछें...'
              : selectedLanguage === 'hinglish'
              ? 'BloodBot se medical question puchiye...'
              : 'Ask BloodBot medical question...'
          }
          className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 text-[13px] px-1 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          className="w-10 h-10 bg-[#b70011] hover:bg-red-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>

      {/* Mandatory Clinical Disclaimer Footer */}
      <p className="text-[11px] text-slate-400 text-center px-4 leading-relaxed">
        BloodBot only provides general blood donation information and never invents hospital data. This is not medical advice, please ask a doctor.
      </p>
    </div>
  );
};
