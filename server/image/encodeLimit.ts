// 编码并发护栏: 限制单进程内同时进行的 sharp/libvips 编码单元数,
// 避免打满 libuv 线程池 (默认 UV_THREADPOOL_SIZE) 后拖慢同池的 fs / dns.lookup.
// 与 instrumentation.ts 里的 sharp.concurrency(1) 配合, 使并发计数与线程占用一致.
const MAX_CONCURRENT_ENCODE = 2

let active = 0
const waiters: Array<() => void> = []

const acquire = (): Promise<void> => {
  if (active < MAX_CONCURRENT_ENCODE) {
    active++
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    waiters.push(resolve)
  })
}

const release = () => {
  const next = waiters.shift()
  if (next) {
    next()
  } else {
    active--
  }
}

export const withEncodeSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  await acquire()
  try {
    return await task()
  } finally {
    release()
  }
}
