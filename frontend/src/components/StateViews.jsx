import { SpinnerIcon } from './Icons'

export function InlineSpinner({ label = 'Loading…', className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center gap-2 ${className}`} role="status" aria-live="polite">
      <SpinnerIcon className="w-4 h-4" />
      {label}
    </span>
  )
}

export function LoadingState({ label = 'Loading…', className = '', fullScreen = false }) {
  const layoutClass = fullScreen
    ? 'min-h-screen bg-blue-50'
    : 'py-16'

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${layoutClass} ${className}`} role="status" aria-live="polite" aria-busy="true">
      <SpinnerIcon className="w-8 h-8 text-blue-700" />
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}

export function RetryButton({ onClick, label = 'Retry', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition-colors ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {label}
    </button>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) {
  return (
    <div className={`bg-red-50 text-red-700 rounded-2xl border border-red-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`} role="alert">
      <div>
        <h3 className="font-semibold mb-0.5">{title}</h3>
        <p className="text-sm">{message}</p>
      </div>
      {onRetry && <RetryButton onClick={onRetry} label={retryLabel} />}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, className = '', iconClassName = 'w-8 h-8' }) {
  return (
    <div className={`text-center py-16 bg-white rounded-2xl border border-blue-100 shadow-sm ${className}`}>
      {Icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-300 mb-4">
          <Icon className={iconClassName} />
        </div>
      )}
      <p className="text-lg font-semibold text-gray-900 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  )
}
