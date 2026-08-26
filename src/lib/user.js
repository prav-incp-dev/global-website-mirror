const userName = (user) => `${user.firstName} ${user.lastName || ''}`.trim()

export { userName }
