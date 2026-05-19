export function MenuToggleIcon({ open, duration = 500, size = 32, color = 'currentColor', style = {}, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      strokeWidth={2.5}
      fill="none"
      stroke={color}
      viewBox="0 0 32 32"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: `transform ${duration}ms cubic-bezier(0.4,0,0.2,1)`,
        transform: open ? 'rotate(-45deg)' : 'rotate(0deg)',
        display: 'block',
        ...style,
      }}
      {...props}
    >
      <path
        style={{
          transition: `stroke-dasharray ${duration}ms cubic-bezier(0.4,0,0.2,1), stroke-dashoffset ${duration}ms cubic-bezier(0.4,0,0.2,1)`,
          strokeDasharray: open ? '20 300' : '12 63',
          strokeDashoffset: open ? '-32.42px' : '0px',
        }}
        d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
      />
      <path d="M7 16 27 16" />
    </svg>
  )
}
