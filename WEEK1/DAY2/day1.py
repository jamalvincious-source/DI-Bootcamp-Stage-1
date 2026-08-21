# Set Operations Exercise

# Create a set called my_fav_numbers and populate it with favorite numbers
my_fav_numbers = {3, 7, 13, 42, 99}
print("My favorite numbers:", my_fav_numbers)

# Add two new numbers to the set
my_fav_numbers.add(88)
my_fav_numbers.add(55)
print("After adding 88 and 55:", my_fav_numbers)

# Remove the last number you added to the set (55)
my_fav_numbers.remove(55)
print("After removing 55:", my_fav_numbers)

# Create another set called friend_fav_numbers and populate it with friend's favorite numbers
friend_fav_numbers = {2, 5, 13, 27, 50}
print("\nFriend's favorite numbers:", friend_fav_numbers)

# Concatenate my_fav_numbers and friend_fav_numbers to create our_fav_numbers
# Using the union operation (|) to combine sets without duplicates
our_fav_numbers = my_fav_numbers | friend_fav_numbers
print("Our combined favorite numbers:", our_fav_numbers)

# Note: Sets automatically handle duplicates - notice 13 appears in both sets
# but only appears once in our_fav_numbers
print("\nNote: The number 13 appears in both sets but only once in the combined set.")
print("This demonstrates that sets automatically eliminate duplicates!")

# Age input
age = input("How old are you? ")
print(f"You are {age} years old")
