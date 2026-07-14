import { describe, it, expect, vi } from 'vitest'
import {
  EncodeBusyError,
  MAX_QUEUE_DEPTH,
  QUEUE_TIMEOUT_MS,
  withEncodeSlot
} from '~/server/image/encodeLimit'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

const defer = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('withEncodeSlot', () => {
  it('在途并发不超过上限 2, 且能打满到 2', async () => {
    let running = 0
    let peak = 0
    const gates = Array.from({ length: 8 }, () => defer<void>())
    const order: number[] = []

    const tasks = gates.map((gate, i) =>
      withEncodeSlot(async () => {
        running++
        peak = Math.max(peak, running)
        await gate.promise
        running--
        order.push(i)
        return i
      })
    )

    await tick()
    // 只有前 2 个进入 task 体, 其余在 acquire 处排队
    expect(running).toBe(2)
    expect(peak).toBe(2)

    // 逐个放行, 任意时刻在途都不应超过 2
    for (const gate of gates) {
      gate.resolve()
      await tick()
      expect(running).toBeLessThanOrEqual(2)
    }

    const results = await Promise.all(tasks)
    expect(peak).toBe(2)
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('排队任务按 FIFO 先到先服务', async () => {
    const gates = Array.from({ length: 4 }, () => defer<void>())
    const started: number[] = []

    const tasks = gates.map((gate, i) =>
      withEncodeSlot(async () => {
        started.push(i)
        await gate.promise
      })
    )

    await tick()
    expect(started).toEqual([0, 1])

    // 释放 0 号, 应唤醒排队头部 2 号
    gates[0].resolve()
    await tick()
    expect(started).toEqual([0, 1, 2])

    gates[1].resolve()
    await tick()
    expect(started).toEqual([0, 1, 2, 3])

    gates[2].resolve()
    gates[3].resolve()
    await Promise.all(tasks)
  })

  it('任务抛错也释放槽位, 后续不被饿死', async () => {
    const boom = () =>
      withEncodeSlot(async () => {
        throw new Error('boom')
      })

    // 连续两个失败任务占满再释放
    await expect(boom()).rejects.toThrow('boom')
    await expect(boom()).rejects.toThrow('boom')

    // 槽位应已归还, 正常任务仍可完成
    await expect(withEncodeSlot(async () => 42)).resolves.toBe(42)
  })

  it('全部失败后并发额度完全恢复', async () => {
    await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        withEncodeSlot(async () => {
          throw new Error('x')
        })
      )
    )

    let running = 0
    let peak = 0
    const gates = Array.from({ length: 4 }, () => defer<void>())
    const tasks = gates.map((gate) =>
      withEncodeSlot(async () => {
        running++
        peak = Math.max(peak, running)
        await gate.promise
        running--
      })
    )

    await tick()
    expect(peak).toBe(2)

    gates.forEach((gate) => gate.resolve())
    await Promise.all(tasks)
  })

  it('等待队列达到上限后拒绝新的编码请求', async () => {
    // 占满 2 个并发槽
    const blockers = Array.from({ length: 2 }, () => defer<void>())
    const activeTasks = blockers.map((b) => withEncodeSlot(() => b.promise))

    // 再填满 MAX_QUEUE_DEPTH 个等待者
    const queuedGate = defer<void>()
    const queuedTasks = Array.from({ length: MAX_QUEUE_DEPTH }, () =>
      withEncodeSlot(() => queuedGate.promise)
    )

    // 队列已满, 第 MAX_QUEUE_DEPTH + 1 个立即被拒
    await expect(withEncodeSlot(async () => 1)).rejects.toBeInstanceOf(
      EncodeBusyError
    )

    // 放行, 恢复干净的模块状态供后续用例复用
    blockers.forEach((b) => b.resolve())
    queuedGate.resolve()
    await Promise.all([...activeTasks, ...queuedTasks])
  })

  it('排队超时后 reject 等待者并释放其占用', async () => {
    vi.useFakeTimers()
    try {
      const gate = defer<void>()
      // 占满 2 个并发槽 (真正在跑)
      const activeTasks = Array.from({ length: 2 }, () =>
        withEncodeSlot(() => gate.promise)
      )

      // 第 3 个进入排队, 到点后应超时被拒
      const queued = withEncodeSlot(async () => 'done')
      const assertion = expect(queued).rejects.toBeInstanceOf(EncodeBusyError)
      await vi.advanceTimersByTimeAsync(QUEUE_TIMEOUT_MS)
      await assertion

      // 放行占位任务, 恢复干净状态
      gate.resolve()
      await vi.runAllTimersAsync()
      await Promise.all(activeTasks)
    } finally {
      vi.useRealTimers()
    }
  })
})
