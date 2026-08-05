// offset 分页下本地删行会使服务端后续记录前移, 存在下一页时前移进当前页的
// 记录从未被展示过, 须静默补拉当前页, 否则向后翻页会正好漏掉这些记录。
// total 必须取本地递减前的值 (删行前与服务端一致的总数)
export const kunShouldBackfillDeletedRow = (
  total: number,
  page: number,
  limit: number
) => total > page * limit
