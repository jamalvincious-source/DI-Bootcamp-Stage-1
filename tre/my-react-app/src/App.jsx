import Exercise2 from './exercise2.jsx'
import Exercise from './Exercise3.js'

const myelement = <h1>I Love JSX!</h1>
const sum = 5 + 5

function App() {
  return (
    <>
      <p>Hello World!</p>
      {myelement}
      <p>React is {sum} times better with JSX</p>
      <Exercise2 />
      <Exercise />
    </>
  )
}

export default App
