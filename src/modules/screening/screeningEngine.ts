export interface ScreeningAnswerInput {
  questionId: string
  answerText: string
}

export interface ScreeningQuestionInput {
  id: string
  prompt: string
  expectedKeywords: string[]
  maxScore: number
}

export interface ScreeningScore {
  score: number
  maxPossible: number
  answers: { questionId: string; score: number; matchedKeywords: string[] }[]
  keywordMatched: string[]
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'have', 'you', 'your', 'are', 'was', 'not', 'but', 'its', 'has', 'had', 'from', 'will', 'would', 'can', 'all', 'our', 'per'])

export function normalizeTokens(text: string): string[] {
  return [...new Set(
    text.toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  )]
}

export function keywordOverlap(expected: string[], text: string): { matched: string[]; ratio: number } {
  const expectedTokens = expected.flatMap((kw) => normalizeTokens(kw))
  const candidateTokens = new Set(normalizeTokens(text))
  const matched = [...new Set(expectedTokens.filter((t) => candidateTokens.has(t)))]
  if (expectedTokens.length === 0) return { matched: [], ratio: 0 }
  return { matched, ratio: matched.length / expectedTokens.length }
}

export function scoreAnswer(expectedKeywords: string[], maxScore: number, answerText: string): { score: number; matchedKeywords: string[] } {
  const { matched } = keywordOverlap(expectedKeywords, answerText)
  const denom = Math.max(1, expectedKeywords.length)
  return { score: Math.round((matched.length / denom) * maxScore), matchedKeywords: matched }
}

export function scoreApplication(input: {
  requirements: string[]
  tags: string[]
  coverLetter: string
  questions: ScreeningQuestionInput[]
  answers: ScreeningAnswerInput[]
}): ScreeningScore {
  const expected = [...input.requirements, ...input.tags].filter(Boolean)
  const { matched } = keywordOverlap(expected, input.coverLetter)
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a]))
  const answers = input.questions.map((q) => {
    const answer = byQuestion.get(q.id)
    return answer
      ? { questionId: q.id, ...scoreAnswer(q.expectedKeywords, q.maxScore, answer.answerText) }
      : { questionId: q.id, score: 0, matchedKeywords: [] }
  })
  const score = matched.length + answers.reduce((sum, a) => sum + a.score, 0)
  const maxPossible = expected.length + input.questions.reduce((sum, q) => sum + q.maxScore, 0)
  return { score, maxPossible, answers, keywordMatched: matched }
}
