from builtins import input, print, range


def add_two_numbers(num1, num2):
    return num1 + num2


print(add_two_numbers(3, 5))  # Output: 8
print(add_two_numbers(10, 20))  # Output: 30

numbers = [1, 2, 3, 4]
print(20)
40
60
80

height = int(input("I am tall 146cm"))

if height > 145:
    print("You are tall enough to ride!")
else:
    print("You need to grow some more to ride.")
list1 = [1, 2, 3, 4]
list2 = [3, 4, 5, 6]

# Find the intersection using set operations and convert back to a list
common_values = list(set(list1) & set(list2))

print(common_values)  # Output: [3, 4]

# Prints the result: ["eile", "mit", "ttam"]
# The [::-1] slice notation reverses any sequence by stepping backwards through it.
   string1 = "first"
string2 = "third"
common_letters = [char for char in string1 if char in string2]
print(list(dict.fromkeys(common_letters)))  # Removes duplicates while preserving order
numbers = [num for num in range(1, 101) if num % 12 == 0]
word = "amazing"
vowels = "aeiouAEIOU"
no_vowels = []

for char in word:
    if char not in vowels:
        no_vowels.append(char)

print(no_vowels)  # Output: ['m', 'z', 'n', 'g']
result = [[i for i in range(3)] for _ in range(3)]
matrix = [list(range(3)) for _ in range(3)]
print(matrix)
matrix = [list(range(10)) for _ in range(10)]
print(matrix)





#exercise 3
print(add_two_numbers(3, 5))  # Output: 8
print(add_two_numbers(10, 20))  # Output: 30