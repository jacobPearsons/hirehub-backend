import { describe, it, expect } from 'vitest'
import { normalizeTokens, keywordOverlap, scoreAnswer, scoreApplication } from '../modules/screening/screeningEngine'

describe('ScreeningEngine', () => {
  it('normalizes and dedupes tokens, dropping stopwords and short words', () => {
    expect(normalizeTokens('Python and React AND python!')).toEqual(['python', 'react'])
  })

  it('computes keyword overlap ratio', () => {
    expect(keywordOverlap(['Python', 'React'], 'I know Python well')).toEqual({ matched: ['python'], ratio: 0.5 })
  })

  it('scores an answer proportionally to maxScore', () => {
    expect(scoreAnswer(['python', 'react'], 10, 'I use python daily')).toEqual({ score: 5, matchedKeywords: ['python'] })
  })

  it('never scores above maxScore for a multi-token keyword', () => {
    expect(scoreAnswer(['react native'], 10, 'I know react and native well')).toEqual({ score: 10, matchedKeywords: ['react', 'native'] })
  })

  it('scores a full application from requirements, tags, cover letter and answers', () => {
    const result = scoreApplication({
      requirements: ['Python', 'FastAPI'],
      tags: ['backend'],
      coverLetter: 'I build APIs with Python',
      questions: [
        { id: 'q1', prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 5 },
        { id: 'q2', prompt: 'FastAPI experience?', expectedKeywords: ['fastapi'], maxScore: 5 },
      ],
      answers: [
        { questionId: 'q1', answerText: 'Five years of python' },
        { questionId: 'q2', answerText: 'No' },
      ],
    })
    expect(result.maxPossible).toBe(13)
    expect(result.score).toBe(6) // cover-letter keyword (1) + q1 (5) + q2 (0)
    expect(result.answers).toEqual([
      { questionId: 'q1', score: 5, matchedKeywords: ['python'] },
      { questionId: 'q2', score: 0, matchedKeywords: [] },
    ])
  })
})
