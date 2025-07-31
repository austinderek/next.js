class Y {
  get named() {
    return 'base-named'
  }

  get default() {
    return 'base-default'
  }
}
class X extends Y {
  get named() {
    return 'named'
  }

  get default() {
    return 'default'
  }
}

module.exports = new X()
