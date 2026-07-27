// 全角开标点 (【（《 等) 的字形墨迹只占右半格, 左半格空白属于字形内部,
// 位于标题行首时视觉上多出约半格缩进, 无法与其他元素左对齐;
// 负首行缩进 0.5em 抵消。集合只收西文字体无字形、必然回退 CJK 字体
// 全角渲染的开标点, 不含 “‘ (西文字体有字形, 渲染为半角, 无左空白)
const CJK_LEADING_PUNCT = /^[【〖〔（《〈「『［｛]/

export const kunCjkIndentClass = (title: string) =>
  CJK_LEADING_PUNCT.test(title) ? '-indent-[0.5em]' : ''
