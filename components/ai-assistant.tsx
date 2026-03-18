'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  MessageSquare,
  FileText,
  AlertTriangle,
  Wrench,
  TrendingUp
} from 'lucide-react'
import { Machine, Alert, MaintenanceTask } from '@/lib/data'

interface AIAssistantProps {
  machines: Machine[]
  alerts: Alert[]
  tasks: MaintenanceTask[]
  selectedMachine: Machine | null
  onClose: () => void
}

export function AIAssistant({
  machines,
  alerts,
  tasks,
  selectedMachine,
  onClose
}: AIAssistantProps) {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/assistant' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Text-to-speech for responses
  useEffect(() => {
    if (isSpeaking && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant' && status === 'ready') {
        const text = lastMessage.parts
          ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map(p => p.text)
          .join('') || ''
        
        if (text && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.rate = 1
          utterance.pitch = 1
          speechSynthesis.speak(utterance)
        }
      }
    }
  }, [messages, status, isSpeaking])

  // Voice recognition
  const toggleListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      if (isListening) {
        recognitionRef.current?.stop()
        setIsListening(false)
      } else {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInput(transcript)
          setIsListening(false)
        }

        recognitionRef.current.onerror = () => {
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current.start()
        setIsListening(true)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Add context about current state
    const context = `
[Current Context]
${selectedMachine ? `Selected Machine: ${selectedMachine.name} (Health: ${selectedMachine.healthIndex}%, RUL: ${selectedMachine.rul} days, Status: ${selectedMachine.status})` : 'No machine selected'}
Critical Alerts: ${alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length}
Overdue Tasks: ${tasks.filter(t => t.status === 'overdue').length}
Fleet Health: ${Math.round(machines.reduce((sum, m) => sum + m.healthIndex, 0) / machines.length)}%

[User Question]
${input}
`
    sendMessage({ text: context })
    setInput('')
  }

  // Quick actions
  const quickActions = [
    { label: 'Generate Report', icon: FileText, prompt: 'Generate a maintenance status report for all machines' },
    { label: 'Critical Issues', icon: AlertTriangle, prompt: 'What are the critical issues that need immediate attention?' },
    { label: 'Schedule Help', icon: Wrench, prompt: 'Help me optimize the maintenance schedule for this week' },
    { label: 'Performance Analysis', icon: TrendingUp, prompt: 'Analyze the overall fleet performance and give recommendations' },
  ]

  const getMessageText = (message: any) => {
    return message.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('') || ''
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">AI Maintenance Assistant</h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Analyzing...' : 'Ready to help'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSpeaking(!isSpeaking)}
            className={cn(
              'h-8 w-8 p-0',
              isSpeaking && 'text-primary'
            )}
            title={isSpeaking ? 'Mute voice' : 'Enable voice'}
          >
            {isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-4">
              Hello! I am your AI maintenance assistant. Ask me about:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 mb-6">
              <li>Machine health and diagnostics</li>
              <li>Maintenance scheduling and optimization</li>
              <li>Failure predictions and risk analysis</li>
              <li>Report generation for technicians</li>
            </ul>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="secondary"
                  size="sm"
                  className="gap-2 text-xs justify-start"
                  onClick={() => {
                    setInput(action.prompt)
                  }}
                >
                  <action.icon className="w-3 h-3" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'user' ? (
                  // Extract just the user question from context
                  getMessageText(message).split('[User Question]').pop()?.trim() || getMessageText(message)
                ) : (
                  <div className="whitespace-pre-wrap">{getMessageText(message)}</div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Button
            type="button"
            variant={isListening ? 'default' : 'secondary'}
            size="sm"
            onClick={toggleListening}
            className={cn(
              'h-10 w-10 p-0 flex-shrink-0',
              isListening && 'animate-pulse'
            )}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Listening...' : 'Ask about maintenance, diagnostics, or reports...'}
            className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading || isListening}
          />
          
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 p-0 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
