const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCSV = (rows, headers) => {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const lines = rows.map((row) => row.map(escapeCsvValue).join(","));
  return [headerLine, ...lines].join("\n");
};

export const buildResponseRows = (form, responses) => {
  const isGraded = form.mode === "quiz" || form.mode === "exam" || form.settings?.autoGrade;
  const headers = [
    "Name",
    "Email",
    "Mobile",
    "Submitted At",
    "Completion Time (s)",
    ...(isGraded ? ["Score", "Max Score", "Passed"] : []),
    ...form.questions.map((q) => q.text),
  ];

  const rows = responses.map((r) => {
    const answerMap = {};
    r.answers.forEach((a) => {
      answerMap[a.questionId] = a.answer;
    });

    const base = [
      r.respondentName,
      r.respondentEmail,
      r.respondentMobile,
      new Date(r.submittedAt).toISOString(),
      r.completionTimeSec,
    ];

    if (isGraded) {
      base.push(r.score, r.maxScore, r.passed === null ? "" : r.passed ? "Yes" : "No");
    }

    form.questions.forEach((q) => {
      const val = answerMap[q.id];
      const hasOptions = ["mcq_single", "mcq_multiple", "dropdown", "checkbox"].includes(q.type);
      if (hasOptions && val) {
        if (Array.isArray(val)) {
          const texts = val.map((id) => {
            const opt = q.options.find((o) => o.id === id);
            return opt ? opt.text : id;
          });
          base.push(texts.join("; "));
        } else {
          const opt = q.options.find((o) => o.id === val);
          base.push(opt ? opt.text : val);
        }
      } else {
        base.push(val ?? "");
      }
    });

    return base;
  });

  return { headers, rows };
};
