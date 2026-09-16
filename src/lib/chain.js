import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { bsc, bscTestnet } from 'viem/chains'

const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key]
  if (typeof process !== 'undefined' && process.env) return process.env[key]

  return undefined
}

const useTestnet = getEnvVar('VITE_TEST_CHAIN') === 'true'
const chain = useTestnet ? bscTestnet : bsc

export const chainId = chain.id

export const usdtAddress = getEnvVar('VITE_BSC_USDT_ADDRESS') || '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
const rpcUrl = getEnvVar('VITE_BSC_RPC_URL') || chain.rpcUrls.default.http[0]

export const usdtDecimals = 18

export const splitPaymentAddress =
  getEnvVar('VITE_BSC_SPLIT_ADDRESS') || '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1'

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

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
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [chain.blockExplorers.default.url],
        },
      ],
    })
  }
}

export const getWalletClient = (provider) => {
  return createWalletClient({
    chain,
    transport: custom(provider),
  })
}

export const getPublicClient = () => {
  if (client) return client

  client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  return client
}
