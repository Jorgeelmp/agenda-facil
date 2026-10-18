import { STATUS } from '../utils/status'

export function StatusBadge({ status }) {
  const info = STATUS[status]
  return <span className={info?.className ?? 'badge'}>{info?.label ?? status}</span>
}
