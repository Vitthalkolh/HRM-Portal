import { formatDays } from '../utils/format'

/**
 * The donut row from the reference portal: one card per leave type showing
 * what is left, with entitlement / used / pending underneath.
 */
export default function BalanceCards({ balances }) {
  if (!balances?.length) return null

  return (
    <div className="grid grid-3" style={{ marginBottom: 16 }}>
      {balances.map((balance) => {
        const color = balance.colorCode || '#2a7fc1'
        const untracked = !balance.isBalanceTracked

        return (
          <div className="balance-card" key={balance.leaveTypeId}>
            <div
              className="donut"
              style={{ border: `3px solid ${color}`, color }}
              title={balance.leaveTypeName}
            >
              {untracked ? '∞' : formatDays(balance.remaining)}
            </div>
            <div>
              <div className="title">{balance.leaveTypeName}</div>
              <div className="detail">
                {untracked ? (
                  'No annual limit — approval still required'
                ) : (
                  <>
                    <strong>{formatDays(balance.entitlement)}</strong> entitled,{' '}
                    <strong>{formatDays(balance.used)}</strong> used,{' '}
                    <strong>{formatDays(balance.pending)}</strong> pending
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
