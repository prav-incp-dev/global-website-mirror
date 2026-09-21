export const walletPreview = (address) => {
  if (!address) return '—'

  return `${address.slice(0, 10)}...${address.slice(-8)}`
}
