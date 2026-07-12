import { describe, it, expect } from 'vitest'
import { withEncodeSlot } from '~/server/image/encodeLimit'

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
})
