/* Lets code outside React (the API base query) navigate with the data router without importing it. */
let activeRouter = null

export function setRouter(router) {
  activeRouter = router
}

export function navigateTo(path, options) {
  if (activeRouter) activeRouter.navigate(path, options)
  else window.location.assign(path)
}
