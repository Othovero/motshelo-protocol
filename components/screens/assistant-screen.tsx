"use client"

import { useState } from "react"
import {
  Sparkles,
  Send,
  TrendingUp,
  Shield,
  CircleDot,
  ArrowRight,
} from "lucide-react"

const suggestions = [
  { icon: TrendingUp, label: "How is my yield performing?" },
  { icon: Shield, label: "Explain the 60/40 yield split" },
  { icon: CircleDot, label: "Which circle should I join?" },
]

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your Motshelo AI assistant. I can help you understand your savings circles, track yield performance, and answer questions about the protocol. What would you like to know?",
  },
]

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Based on your current portfolio, your Ubuntu Savers circle is generating the highest yield at approximately 3.5% APY via Aave V3. Your total accrued yield across all circles is $127.65, of which $51.06 is your 40% share. I recommend continuing to contribute consistently to maximize your yield earnings.",
      },
    ])
    setInput("")
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-80px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-motshelo-glow">
          <Sparkles className="size-5 text-motshelo-blue" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">Powered by Motshelo Protocol</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "self-end bg-motshelo-blue text-primary-foreground"
                : "self-start bg-card text-foreground"
            }`}
          >
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
        ))}

        {/* Suggestions (only show at beginning) */}
        {messages.length <= 1 && (
          <div className="flex flex-col gap-2 mt-2">
            {suggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setInput(s.label)
                }}
                className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 text-left hover:bg-secondary transition-colors ring-1 ring-border"
              >
                <s.icon className="size-4 text-motshelo-blue shrink-0" />
                <span className="text-xs text-foreground">{s.label}</span>
                <ArrowRight className="size-3.5 text-muted-foreground ml-auto shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-2 pb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your circles..."
          className="flex-1 rounded-xl bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all"
        />
        <button
          onClick={handleSend}
          className="flex size-11 items-center justify-center rounded-xl bg-motshelo-blue text-primary-foreground hover:bg-motshelo-blue/90 transition-colors shrink-0"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  )
}
