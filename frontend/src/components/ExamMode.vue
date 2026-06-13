<template>
  <div class="flex flex-col gap-4">
    <!-- Idle / Start Screen -->
    <div v-if="store.examStatus === 'idle'" class="bg-gray-900 rounded-xl p-6">
      <h3 class="text-amber-300 font-bold text-xl mb-4 text-center">考试模式</h3>
      <p class="text-gray-400 text-center mb-6">限时听音写码，交卷后查看成绩和错题</p>

      <div class="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6">
        <div>
          <label class="text-gray-400 text-sm block mb-1">题目数量</label>
          <select v-model.number="questionCount" class="w-full bg-gray-800 rounded px-3 py-2">
            <option :value="10">10 题</option>
            <option :value="20">20 题</option>
            <option :value="30">30 题</option>
            <option :value="50">50 题</option>
          </select>
        </div>
        <div>
          <label class="text-gray-400 text-sm block mb-1">时间限制（秒）</label>
          <select v-model.number="timeLimit" class="w-full bg-gray-800 rounded px-3 py-2">
            <option :value="60">60 秒</option>
            <option :value="120">120 秒</option>
            <option :value="180">180 秒</option>
            <option :value="300">300 秒</option>
          </select>
        </div>
      </div>

      <div class="text-center">
        <button @click="handleStartExam" class="bg-amber-500 text-black px-8 py-3 rounded-lg text-lg font-bold hover:bg-amber-400">
          开始考试
        </button>
      </div>
    </div>

    <!-- Exam in Progress -->
    <div v-else-if="store.examStatus === 'answering' || store.examStatus === 'playing'" class="bg-gray-900 rounded-xl p-6">
      <!-- Header: Timer & Progress -->
      <div class="flex justify-between items-center mb-6">
        <div class="text-gray-400">
          第 <span class="text-amber-400 font-bold">{{ store.examCurrentIndex + 1 }}</span> / {{ store.examQuestions.length }} 题
        </div>
        <div class="text-2xl font-mono font-bold" :class="store.examRemainingTime <= 10 ? 'text-red-400' : 'text-green-400'">
          ⏱ {{ formatTime(store.examRemainingTime) }}
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="w-full bg-gray-800 rounded-full h-2 mb-6">
        <div class="bg-amber-500 h-2 rounded-full transition-all" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- Question Display -->
      <div class="flex flex-col items-center gap-6">
        <button @click="store.playCurrentExamQuestion()" :disabled="store.isPlaying"
          class="bg-green-600 px-8 py-4 rounded-lg text-xl hover:bg-green-500 disabled:opacity-50 w-64">
          {{ store.isPlaying ? '🔊 播放中...' : '🔊 播放音频' }}
        </button>

        <div class="text-gray-400 text-sm">
          听音频，写出对应的莫尔斯码（用 . 和 - 表示）
        </div>

        <input
          ref="answerInput"
          :value="currentAnswer"
          @input="handleAnswerInput"
          @keyup.enter="handleNext"
          class="bg-gray-800 rounded px-4 py-3 text-center text-2xl w-64 font-mono text-green-400"
          placeholder="输入莫尔斯码"
          :disabled="store.isPlaying"
        />

        <!-- Navigation Buttons -->
        <div class="flex gap-3">
          <button @click="store.prevExamQuestion()" :disabled="store.examCurrentIndex === 0"
            class="bg-gray-700 px-5 py-2 rounded hover:bg-gray-600 disabled:opacity-30">
            ← 上一题
          </button>
          <button v-if="store.examCurrentIndex < store.examQuestions.length - 1"
            @click="handleNext"
            class="bg-amber-500 text-black px-5 py-2 rounded font-medium hover:bg-amber-400">
            下一题 →
          </button>
          <button v-else
            @click="handleSubmit"
            class="bg-red-600 px-5 py-2 rounded font-medium hover:bg-red-500">
            交卷 ✓
          </button>
        </div>
      </div>

      <!-- Question Dots -->
      <div class="flex flex-wrap justify-center gap-1 mt-6">
        <div v-for="(q, idx) in store.examQuestions" :key="q.id"
          class="w-3 h-3 rounded-full cursor-pointer"
          :class="{
            'bg-amber-500': idx === store.examCurrentIndex,
            'bg-gray-600': idx !== store.examCurrentIndex && !q.userAnswer,
            'bg-green-600': idx !== store.examCurrentIndex && q.userAnswer,
          }"
          @click="jumpToQuestion(idx)">
        </div>
      </div>
    </div>

    <!-- Exam Result -->
    <div v-else-if="store.examStatus === 'finished' && store.examResult" class="flex flex-col gap-4">
      <!-- Score Card -->
      <div class="bg-gray-900 rounded-xl p-6 text-center">
        <h3 class="text-amber-300 font-bold text-xl mb-4">考试结果</h3>
        <div class="text-6xl font-bold text-amber-400 mb-4">{{ store.examResult.score }} 分</div>

        <div class="grid grid-cols-4 gap-3 max-w-lg mx-auto">
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-2xl font-bold text-blue-400">{{ store.examResult.total }}</div>
            <div class="text-xs text-gray-400">总题数</div>
          </div>
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-2xl font-bold text-green-400">{{ store.examResult.correct }}</div>
            <div class="text-xs text-gray-400">答对</div>
          </div>
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-2xl font-bold text-red-400">{{ store.examResult.wrong }}</div>
            <div class="text-xs text-gray-400">答错</div>
          </div>
          <div class="bg-gray-800 rounded-lg p-3">
            <div class="text-2xl font-bold text-purple-400">{{ formatTime(store.examResult.duration) }}</div>
            <div class="text-xs text-gray-400">用时</div>
          </div>
        </div>
      </div>

      <!-- Wrong Questions List -->
      <div v-if="wrongQuestions.length > 0" class="bg-gray-900 rounded-xl p-6">
        <h3 class="text-red-400 font-bold mb-4">错题名单 ({{ wrongQuestions.length }} 题)</h3>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <div v-for="q in wrongQuestions" :key="q.id"
            class="flex justify-between items-center bg-gray-800 rounded-lg p-3 border-l-4 border-red-500">
            <div class="flex items-center gap-4">
              <span class="text-3xl font-bold text-amber-400 w-10 text-center">{{ q.char }}</span>
              <div class="flex flex-col">
                <span class="text-sm text-gray-400">你的答案: <span class="text-red-400 font-mono">{{ q.userAnswer || '(未作答)' }}</span></span>
                <span class="text-sm text-gray-400">正确答案: <span class="text-green-400 font-mono">{{ MORSE_TABLE[q.char] }}</span></span>
              </div>
            </div>
            <button @click="playWrongAnswer(q.char)" class="text-gray-400 hover:text-white text-sm px-3 py-1 bg-gray-700 rounded">
              🔊 再听一次
            </button>
          </div>
        </div>
      </div>

      <!-- All Questions Review -->
      <div class="bg-gray-900 rounded-xl p-6">
        <h3 class="text-amber-300 font-bold mb-4">答题详情</h3>
        <div class="grid grid-cols-5 md:grid-cols-10 gap-2">
          <div v-for="(q, idx) in store.examResult.questions" :key="q.id"
            class="bg-gray-800 rounded p-2 text-center"
            :class="q.correct ? 'border-b-2 border-green-500' : 'border-b-2 border-red-500'">
            <div class="text-lg font-bold" :class="q.correct ? 'text-green-400' : 'text-red-400'">{{ q.char }}</div>
            <div class="text-xs text-gray-500">{{ idx + 1 }}</div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-center gap-3">
        <button @click="store.resetExam()" class="bg-gray-700 px-6 py-3 rounded-lg hover:bg-gray-600">
          返回
        </button>
        <button @click="handleRetry" class="bg-amber-500 text-black px-6 py-3 rounded-lg font-bold hover:bg-amber-400">
          再来一次
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useMorseStore } from '../store/morse'
import { MORSE_TABLE } from '../utils/morse-code'

const store = useMorseStore()

const questionCount = ref(20)
const timeLimit = ref(120)
const answerInput = ref<HTMLInputElement | null>(null)

const currentAnswer = computed(() => {
  const q = store.getExamCurrentQuestion()
  return q ? q.userAnswer : ''
})

const progressPercent = computed(() => {
  if (store.examQuestions.length === 0) return 0
  return ((store.examCurrentIndex + 1) / store.examQuestions.length) * 100
})

const wrongQuestions = computed(() => store.getWrongQuestions())

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function handleStartExam() {
  store.examTimeLimit = timeLimit.value
  store.startExam(questionCount.value)
  nextTick(() => {
    answerInput.value?.focus()
  })
}

function handleAnswerInput(e: Event) {
  const target = e.target as HTMLInputElement
  store.setExamAnswer(target.value)
}

function handleNext() {
  if (store.examCurrentIndex < store.examQuestions.length - 1) {
    store.nextExamQuestion()
    nextTick(() => {
      answerInput.value?.focus()
    })
  }
}

function handleSubmit() {
  if (confirm('确定要交卷吗？')) {
    store.submitExam()
  }
}

function jumpToQuestion(idx: number) {
  store.examCurrentIndex = idx
  store.examShowAnswer = false
  nextTick(() => {
    answerInput.value?.focus()
  })
}

function playWrongAnswer(char: string) {
  store.playMorse(MORSE_TABLE[char])
}

function handleRetry() {
  store.examTimeLimit = timeLimit.value
  store.startExam(questionCount.value)
  nextTick(() => {
    answerInput.value?.focus()
  })
}

watch(() => store.examStatus, (status) => {
  if (status === 'answering') {
    nextTick(() => {
      answerInput.value?.focus()
    })
  }
})
</script>
