export const arraysEqualAsSets = (a = [], b = []) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((v) => setA.has(v));
};

/**
 * Grades a single question against a submitted answer.
 * Returns { isCorrect, marksAwarded }.
 * isCorrect is null for ungraded question types (e.g. short_text with no correctAnswer set).
 */
export const gradeQuestion = (question, submittedAnswer) => {
  if (question.correctAnswer === null || question.correctAnswer === undefined) {
    return { isCorrect: null, marksAwarded: 0 };
  }

  let correct;
  if (Array.isArray(question.correctAnswer)) {
    correct = arraysEqualAsSets(question.correctAnswer, submittedAnswer);
  } else {
    correct = String(question.correctAnswer) === String(submittedAnswer);
  }

  return {
    isCorrect: correct,
    marksAwarded: correct ? question.marks || 0 : -(question.negativeMarks || 0),
  };
};

/**
 * Grades a full set of submitted answers against a form's questions.
 * Returns { gradedAnswers, score, maxScore }.
 */
export const gradeSubmission = (questions, answers, shouldGrade) => {
  let score = 0;
  let maxScore = 0;

  const gradedAnswers = (answers || []).map((a) => {
    const question = questions.find((q) => q.id === a.questionId);
    if (!question) return { questionId: a.questionId, answer: a.answer };

    const hasCorrectAnswer = question.correctAnswer !== null && question.correctAnswer !== undefined && (Array.isArray(question.correctAnswer) ? question.correctAnswer.length > 0 : true);

    if (shouldGrade && hasCorrectAnswer) {
      maxScore += question.marks || 0;
    }

    if (!shouldGrade) {
      return { questionId: a.questionId, answer: a.answer };
    }

    const { isCorrect, marksAwarded } = gradeQuestion(question, a.answer);
    score += marksAwarded;
    return { questionId: a.questionId, answer: a.answer, isCorrect, marksAwarded };
  });

  return { gradedAnswers, score, maxScore };
};

export const computePassed = (settings, shouldGrade, score, maxScore) => {
  if (!shouldGrade) return null;
  if (settings.passMarks) return score >= settings.passMarks;
  return score >= maxScore / 2;
};
