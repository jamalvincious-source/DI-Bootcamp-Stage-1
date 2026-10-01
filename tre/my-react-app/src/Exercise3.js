import { Component, createElement } from 'react'
import './Exercise.css'

const style_header = {
  color: 'white',
  backgroundColor: 'DodgerBlue',
  padding: '10px',
  fontFamily: 'Arial',
}

class Exercise extends Component {
  render() {
    return createElement(
      'section',
      null,
      createElement('h1', { style: style_header }, 'This is a title'),
      createElement(
        'p',
        { className: 'para' },
        'This is a paragraph with some text.',
      ),
      createElement(
        'a',
        { href: 'https://www.example.com' },
        'Visit Example.com',
      ),
      createElement(
        'form',
        { onSubmit: (event) => event.preventDefault() },
        createElement('label', { htmlFor: 'exercise-name' }, 'Name: '),
        createElement('input', {
          id: 'exercise-name',
          name: 'name',
          type: 'text',
        }),
        createElement('button', { type: 'submit' }, 'Submit'),
      ),
      createElement('img', {
        src: 'https://picsum.photos/200',
        alt: 'Random landscape',
        width: 200,
        height: 200,
      }),
      createElement(
        'ul',
        null,
        ['First item', 'Second item', 'Third item'].map((item) =>
          createElement('li', { key: item }, item),
        ),
      ),
    )
  }
}

export default Exercise
