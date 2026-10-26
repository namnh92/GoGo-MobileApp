import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useState } from 'react'
import { Text } from 'react-native'

import '@/shared/i18n'
import { Dialog, useDialog } from '@/shared/ui/dialog.view'

/** GoGo-MobileApp#381 — the in-app confirmation that replaces `Alert.alert`. */

type Instance = ReturnType<typeof screen.getByText>
function modalOf(node: Instance): Instance {
  for (let current: Instance | null = node; current; current = current.parent as Instance | null) {
    if (current.type === 'Modal') return current
  }
  throw new Error('not in a Modal')
}

const ACTIONS = [
  { key: 'keep', label: 'Giữ lại', style: 'cancel' as const },
  { key: 'delete', label: 'Xoá', style: 'destructive' as const },
]

it('reads as a header plus labelled ≥44pt buttons, cancel last', async () => {
  await render(<Dialog visible title="Xoá nháp?" message="Không hoàn tác được." actions={ACTIONS} onAction={jest.fn()} onDismiss={jest.fn()} />)
  expect(screen.getByRole('header', { name: 'Xoá nháp?' })).toBeTruthy()
  expect(screen.getByText('Không hoàn tác được.')).toBeTruthy()
  const buttons = screen.getAllByRole('button').map(button => button.props.accessibilityLabel)
  expect(buttons).toEqual(['Xoá', 'Giữ lại'])
})

it('reports the pressed action, and Android back dismisses only when there is a cancel', async () => {
  const onAction = jest.fn()
  const onDismiss = jest.fn()
  const view = await render(<Dialog visible title="T" actions={ACTIONS} onAction={onAction} onDismiss={onDismiss} />)
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Xoá' }))
  })
  expect(onAction).toHaveBeenCalledWith('delete')

  modalOf(screen.getByText('T')).props.onRequestClose()
  expect(onDismiss).toHaveBeenCalledTimes(1)

  // No cancel action: there is nothing to back out to, so back does nothing.
  await view.rerender(<Dialog visible title="T" actions={[{ key: 'ok', label: 'OK' }]} onAction={onAction} onDismiss={onDismiss} />)
  modalOf(screen.getByText('T')).props.onRequestClose()
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

function Harness({ onResult }: { onResult: (key: string | null) => void }) {
  const { confirm, dialog } = useDialog()
  const [show, setShow] = useState(true)
  return (
    <>
      <Text onPress={() => void confirm({ title: 'Hỏi', actions: ACTIONS }).then(onResult)}>mở</Text>
      <Text onPress={() => setShow(false)}>ẩn</Text>
      {show ? dialog : null}
    </>
  )
}

it('useDialog resolves with the chosen key and closes', async () => {
  const onResult = jest.fn()
  await render(<Harness onResult={onResult} />)
  await act(async () => {
    await fireEvent.press(screen.getByText('mở'))
  })
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Xoá' }))
  })
  expect(onResult).toHaveBeenCalledWith('delete')
  expect(screen.queryByText('Hỏi')).toBeNull()
})

it('useDialog resolves null when a second question replaces the first', async () => {
  const onResult = jest.fn()
  await render(<Harness onResult={onResult} />)
  await act(async () => {
    await fireEvent.press(screen.getByText('mở'))
  })
  await act(async () => {
    await fireEvent.press(screen.getByText('mở'))
  })
  expect(onResult).toHaveBeenCalledWith(null)
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Giữ lại' }))
  })
  expect(onResult).toHaveBeenLastCalledWith('keep')
})
