export interface MorseSymbol {
  char: string
  code: string
}

export type TrainMode = 'charToCode' | 'codeToChar' | 'audioToChar' | 'typingToCode'

export interface HistoryEntry {
  id: number
  input: string
  output: string
  correct: boolean
  timestamp: number
}

export interface ExamQuestion {
  id: number
  char: string
  userAnswer: string
  correct: boolean
  timestamp: number
}

export interface ExamResult {
  total: number
  correct: number
  wrong: number
  score: number
  duration: number
  questions: ExamQuestion[]
}

export type ExamStatus = 'idle' | 'playing' | 'answering' | 'finished'
