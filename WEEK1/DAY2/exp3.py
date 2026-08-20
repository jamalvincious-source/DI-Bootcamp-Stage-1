# Exercise: Find Index of Name in List
# Instructions: Ask user for their name, if it's in the list, print the first occurrence index

print("=" * 60)
print("Character Name Index Finder")
print("=" * 60)
print()

# Initialize the names list
names = ['Samus', 'Cortana', 'V', 'Link', 'Mario', 'Cortana', 'Samus']

print(f"Available names: {nvin}")
print()

# Ask user for their name
user_name = input("Enter your name: ").strip()

# Check if name is in the list
if user_name in names:
    # Find the index of the first occurrence
    index = names.index(user_name)
    print(f"✅ '{user_name}' found at index {index}")
else:
    print(f"❌ '{user_name}' is not in the list.")
    print(f"Available names: {names}")
Instructions
Using this variable

names = ['Samus', 'Cortana', 'V', 'Link', 'Mario', 'Cortana', 'Samus']
Ask a user for their name, if their name is in the names list print out the index of the first occurence of the name.

Example: if input is 'Cortana' we should be printing the index 1
