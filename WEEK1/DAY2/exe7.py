# Exercise 7: Input/Output, Strings and Lists, Conditionals
# Topics: Input/output, Strings, Lists, Conditionals (if/else)

print("=" * 60)
print("Favorite Fruits Exercise")
print("=" * 60)
print()

# Ask the user to input their favorite fruits (separated by spaces)
favorite_fruits_input = input("Enter your favorite fruits (separated by spaces): ")

# Store these fruits in a list by splitting the input string
favorite_fruits = favorite_fruits_input.split()

print()
print(f"Your favorite fruits: {favorite_fruits}")
print()

# Ask the user to input the name of any fruit
chosen_fruit = input("Enter a fruit name: ")

# Check if the fruit is in their list of favorite fruits
if chosen_fruit in favorite_fruits:
    print("You chose one of your favorite fruits! Enjoy!")
else:
    print("You chose a new fruit. I hope you enjoy it!")

print()
