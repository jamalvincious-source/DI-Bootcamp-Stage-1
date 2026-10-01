import UserFavoriteAnimals from './UserFavoriteAnimals.js'

function Exercise2() {
  const user = {
    firstName: 'Bob',
    lastName: 'Dylan',
    favAnimals: ['Horse', 'Turtle', 'Elephant', 'Monkey'],
  }

  return (
    <>
      <h3>{user.firstName}</h3>
      <h3>{user.lastName}</h3>
      <UserFavoriteAnimals favAnimals={user.favAnimals} />
    </>
  )
}

export default Exercise2
