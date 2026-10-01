import { Component, createElement } from 'react'

class UserFavoriteAnimals extends Component {
  render() {
    return createElement(
      'ul',
      null,
      this.props.favAnimals.map((animal, index) =>
        createElement('li', { key: index }, animal),
      ),
    )
  }
}

export default UserFavoriteAnimals
