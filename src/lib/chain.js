import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { bscTestnet } from 'viem/chains'

export const rpcUrl = process.env.VITE_BSC_TESTNET_RPC_URL || bscTestnet.rpcUrls.default.http[0]

export const chainId = bscTestnet.id

export const usdtAddress = process.env.VITE_BSC_TESTNET_USDT_ADDRESS || '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'

export const usdtDecimals = 18

let client = null

export const ensureChain = async (provider) => {
  const hexChainId = `0x${chainId.toString(16)}`
  const currentChainId = await provider.request({ method: 'eth_chainId' })

  if (currentChainId?.toLowerCase() === hexChainId.toLowerCase()) {
    return
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    })
  } catch (switchErr) {
    if (switchErr?.code !== 4902) {
      throw switchErr
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexChainId,
          chainName: bscTestnet.name,
          nativeCurrency: bscTestnet.nativeCurrency,
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [bscTestnet.blockExplorers.default.url],
        },
      ],
    })
  }
}

export const getWalletClient = (provider) => {
  return createWalletClient({
    chain: bscTestnet,
    transport: custom(provider),
  })
}

export const getPublicClient = () => {
  if (client) return client

  client = createPublicClient({
    chain: bscTestnet,
    transport: http(rpcUrl),
  })

  return client
}
