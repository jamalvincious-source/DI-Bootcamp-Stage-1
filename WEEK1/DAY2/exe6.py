# Exercise 6: While Loop and Conditionals
# Topics: Loops (while), Conditionals (if)

print("=" * 60)
print("Name Validation Exercise")
print("=" * 60)
print()

# Ask for user's name with validation
while True:
    name = input("Please enter your name: ")
    
    # Check if the input is correct
    # Conditions:
    # 1. Must not contain only digits (use isdigit())
    # 2. Must be at least 3 letters long
    # 3. Must not be empty
    
    if name.isdigit():
        print("❌ Invalid! Your name cannot contain only digits.")
        print()
    elif len(name) < 3:
        print("❌ Invalid! Your name must be at least 3 letters long.")
        print()
    elif not name.isalpha():
        print("❌ Invalid! Your name can only contain letters (no numbers or special characters).")
        print()
    else:
        print("✅ Thank you!")
        break

print()
print("=" * 60)
print(f"Welcome, {name}!")
print("=" * 60)
Input/output
Strings and lists
Conditionals
