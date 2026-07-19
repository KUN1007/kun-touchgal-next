import type { CapWidget } from 'cap-widget'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'cap-widget': React.DetailedHTMLProps<
        React.HTMLAttributes<CapWidget>,
        CapWidget
      > & {
        'data-cap-api-endpoint'?: string
        'data-cap-worker-count'?: string
        'data-cap-hidden-field-name'?: string
        'data-cap-i18n-initial-state'?: string
        'data-cap-i18n-verifying-label'?: string
        'data-cap-i18n-solved-label'?: string
        'data-cap-i18n-error-label'?: string
        'data-cap-i18n-verify-aria-label'?: string
        'data-cap-i18n-verifying-aria-label'?: string
        'data-cap-i18n-verified-aria-label'?: string
        'data-cap-i18n-error-aria-label'?: string
        'data-cap-troubleshooting-url'?: string
      }
    }
  }
}
