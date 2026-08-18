def greet(name):
    print(f"Hello, {name}!")


def check_even_odd(number):
    if number % 2 == 0:
        print("Even")
    else:
        print("Odd")


def sum_list(numbers):
    total = 0
    for number in numbers:
        total += number
    return total


def print_days():
    days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ]
    for day in days:
        print(day)


def check_sign(number):
    if number > 0:
        print("Positive")
    elif number < 0:
        print("Negative")
    else:
        print("Zero")


def repeat_word(word, times):
    for _ in range(times):
        print(word)


greet("Alice")
greet("Bob")
check_even_odd(4)
check_even_odd(7)
print(sum_list([1, 2, 3, 4]))
print(sum_list([5, 5, 5]))
print_days()
check_sign(10)
check_sign(-5)
check_sign(0)
repeat_word("hello", 3)
repeat_word("goodbye", 2)
