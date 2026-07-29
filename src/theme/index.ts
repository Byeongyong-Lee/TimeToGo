export const colors = {
  background: '#FFFFFF',
  surface: '#F5F6F8',
  border: '#E3E5E9',
  text: '#14161A',
  textMuted: '#6B7280',
  primary: '#2F6BFF',
  primaryText: '#FFFFFF',
  danger: '#D83A34',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;
