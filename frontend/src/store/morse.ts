import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { MORSE_TABLE, REVERSE_TABLE, textToMorse, morseToText } from '../utils/morse-code'
import type { TrainMode, HistoryEntry, ExamQuestion, ExamResult, ExamStatus } from '../types'

export const useMorseStore = defineStore('morse', () => {
  const inputText = ref('')
  const morseOutput = ref('')
  const decodedText = ref('')
  const wpm = ref(15)
  const frequency = ref(700)
  const volume = ref(0.6)
  const trainMode = ref<TrainMode>('charToCode')
  const history = ref<HistoryEntry[]>([])
  const quizChar = ref('')
  const userAnswer = ref('')
  const score = ref({ correct: 0, total: 0 })
  const isPlaying = ref(false)
  let audioCtx: AudioContext | null = null
  let currentOscillator: OscillatorNode | null = null

  const examStatus = ref<ExamStatus>('idle')
  const examQuestions = ref<ExamQuestion[]>([])
  const examCurrentIndex = ref(0)
  const examTimeLimit = ref(60)
  const examStartTime = ref(0)
  const examRemainingTime = ref(0)
  const examResult = ref<ExamResult | null>(null)
  const examShowAnswer = ref(false)
  let examTimer: number | null = null

  const EXAM_STORAGE_KEY = 'morse_exam_state'

  const dotDuration = computed(() => 1200 / wpm.value)

  function getAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  function playTone(duration: number): Promise<void> {
    return new Promise(resolve => {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency.value
      gain.gain.value = volume.value
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      currentOscillator = osc
      setTimeout(() => { osc.stop(); currentOscillator = null; resolve() }, duration)
    })
  }

  async function playMorse(morse: string) {
    isPlaying.value = true
    const dd = dotDuration.value
    for (const token of morse.split(' ')) {
      if (token === '/') { await sleep(dd * 7); continue }
      for (const sym of token) {
        await playTone(sym === '.' ? dd : dd * 3)
        await sleep(dd)
      }
      await sleep(dd * 2)
    }
    isPlaying.value = false
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  function encode() {
    morseOutput.value = textToMorse(inputText.value)
  }

  function decode() {
    decodedText.value = morseToText(inputText.value)
  }

  function generateQuiz() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    userAnswer.value = ''
  }

  function checkAnswer() {
    const correct = userAnswer.value.trim() === MORSE_TABLE[quizChar.value]
    score.value.total++
    if (correct) score.value.correct++
    history.value.unshift({
      id: Date.now(), input: quizChar.value, output: userAnswer.value,
      correct, timestamp: Date.now()
    })
    generateQuiz()
  }

  function resetScore() {
    score.value = { correct: 0, total: 0 }
    history.value = []
  }

  function generateExamQuestions(count: number): ExamQuestion[] {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const questions: ExamQuestion[] = []
    for (let i = 0; i < count; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)]
      questions.push({
        id: Date.now() + i,
        char,
        userAnswer: '',
        correct: false,
        timestamp: 0,
      })
    }
    return questions
  }

  function startExam(questionCount: number = 20) {
    examQuestions.value = generateExamQuestions(questionCount)
    examCurrentIndex.value = 0
    examStartTime.value = Date.now()
    examRemainingTime.value = examTimeLimit.value
    examResult.value = null
    examShowAnswer.value = false
    examStatus.value = 'answering'
    startExamTimer()
  }

  function startExamTimer() {
    if (examTimer) clearInterval(examTimer)
    examTimer = window.setInterval(() => {
      if (examStatus.value !== 'answering') return
      const elapsed = Math.floor((Date.now() - examStartTime.value) / 1000)
      examRemainingTime.value = Math.max(0, examTimeLimit.value - elapsed)
      if (examRemainingTime.value <= 0) {
        submitExam()
      }
    }, 1000)
  }

  function setExamAnswer(answer: string) {
    if (examCurrentIndex.value < examQuestions.value.length) {
      examQuestions.value[examCurrentIndex.value].userAnswer = answer
    }
  }

  function getExamCurrentQuestion(): ExamQuestion | null {
    if (examCurrentIndex.value < examQuestions.value.length) {
      return examQuestions.value[examCurrentIndex.value]
    }
    return null
  }

  async function playCurrentExamQuestion() {
    const q = getExamCurrentQuestion()
    if (q && !isPlaying.value) {
      examStatus.value = 'playing'
      await playMorse(MORSE_TABLE[q.char])
      if (examStatus.value === 'playing') {
        examStatus.value = 'answering'
      }
    }
  }

  function nextExamQuestion() {
    if (examCurrentIndex.value < examQuestions.value.length - 1) {
      examCurrentIndex.value++
      examShowAnswer.value = false
    }
  }

  function prevExamQuestion() {
    if (examCurrentIndex.value > 0) {
      examCurrentIndex.value--
      examShowAnswer.value = false
    }
  }

  function submitExam() {
    if (examTimer) {
      clearInterval(examTimer)
      examTimer = null
    }
    const duration = Math.floor((Date.now() - examStartTime.value) / 1000)
    let correct = 0
    const questions = examQuestions.value.map(q => {
      const isCorrect = q.userAnswer.trim() === MORSE_TABLE[q.char]
      if (isCorrect) correct++
      return { ...q, correct: isCorrect }
    })
    examResult.value = {
      total: questions.length,
      correct,
      wrong: questions.length - correct,
      score: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      duration,
      questions,
    }
    examStatus.value = 'finished'
  }

  function resetExam() {
    if (examTimer) {
      clearInterval(examTimer)
      examTimer = null
    }
    examStatus.value = 'idle'
    examQuestions.value = []
    examCurrentIndex.value = 0
    examStartTime.value = 0
    examRemainingTime.value = 0
    examResult.value = null
    examShowAnswer.value = false
  }

  function getWrongQuestions(): ExamQuestion[] {
    if (!examResult.value) return []
    return examResult.value.questions.filter(q => !q.correct)
  }

  function saveExamState() {
    if (examStatus.value === 'idle' || examStatus.value === 'finished') return
    try {
      const state = {
        status: examStatus.value,
        questions: examQuestions.value,
        currentIndex: examCurrentIndex.value,
        timeLimit: examTimeLimit.value,
        startTime: examStartTime.value,
      }
      localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Failed to save exam state:', e)
    }
  }

  function clearExamStorage() {
    try {
      localStorage.removeItem(EXAM_STORAGE_KEY)
    } catch (e) {
      console.warn('Failed to clear exam storage:', e)
    }
  }

  function hasSavedExam(): boolean {
    try {
      const raw = localStorage.getItem(EXAM_STORAGE_KEY)
      if (!raw) return false
      const state = JSON.parse(raw)
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
      return state.status === 'answering' || state.status === 'playing'
        && elapsed < state.timeLimit
    } catch {
      return false
    }
  }

  function resumeExam(): boolean {
    try {
      const raw = localStorage.getItem(EXAM_STORAGE_KEY)
      if (!raw) return false
      const state = JSON.parse(raw)
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
      if (elapsed >= state.timeLimit) {
        clearExamStorage()
        return false
      }
      examQuestions.value = state.questions
      examCurrentIndex.value = state.currentIndex
      examTimeLimit.value = state.timeLimit
      examStartTime.value = state.startTime
      examRemainingTime.value = Math.max(0, state.timeLimit - elapsed)
      examStatus.value = 'answering'
      examResult.value = null
      examShowAnswer.value = false
      startExamTimer()
      return true
    } catch (e) {
      console.warn('Failed to resume exam:', e)
      return false
    }
  }

  watch(
    () => [examStatus.value, examCurrentIndex.value, examQuestions.value],
    () => {
      saveExamState()
    },
    { deep: true }
  )

  watch(
    () => examStatus.value,
    (status) => {
      if (status === 'finished' || status === 'idle') {
        clearExamStorage()
      }
    }
  )

  return {
    inputText, morseOutput, decodedText, wpm, frequency, volume,
    trainMode, history, quizChar, userAnswer, score, isPlaying,
    dotDuration, encode, decode, playMorse, playTone,
    generateQuiz, checkAnswer, resetScore,
    examStatus, examQuestions, examCurrentIndex, examTimeLimit,
    examRemainingTime, examResult, examShowAnswer,
    startExam, setExamAnswer, getExamCurrentQuestion,
    playCurrentExamQuestion, nextExamQuestion, prevExamQuestion,
    submitExam, resetExam, getWrongQuestions,
    hasSavedExam, resumeExam, saveExamState
  }
})
