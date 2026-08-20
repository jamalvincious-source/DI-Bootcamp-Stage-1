# Exercise 5: For Loop
# Topics: Loops (for), Range and indexing

print("=" * 60)
print("For Loop Exercise")
print("=" * 60)
print()

# Task 1: Write a for loop to print all numbers from 1 to 20, inclusive
print("Task 1: Print all numbers from 1 to 20 (inclusive)")
print("-" * 60)
for num in range(1, 21):  # range(1, 21) gives 1 to 20
    print(num, end=" ")
print("\n")  # New line for readability

# Task 2: Print every number from 1 to 20 where the index is even
print("Task 2: Print numbers at even indices (from 1 to 20)")
print("-" * 60)
print("Method 1: Using range with step 2")
for num in range(2, 21, 2):  # Start at 2, go to 20, step by 2
    print(num, end=" ")
print("\n")

print("Method 2: Using range and checking if index is even")
for i in range(1, 21):
    if i % 2 == 0:  # Check if number is even
        print(i, end=" ")
print("\n")

print("Method 3: Using enumerate to track indices")
numbers = list(range(1, 21))
for index, num in enumerate(numbers):
    if index % 2 == 0:  # Check if index (0-based) is even
        print(num, end=" ")
print("\n")

print()
print("=" * 60)
print("Explanation:")
print("=" * 60)
print("Task 1: range(1, 21) generates numbers 1 through 20")
print("Task 2: We have two interpretations:")
print("  - Even numbers: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20")
print("  - Even indices (0-based): Elements at positions 0, 2, 4...")
print("  - In 1-20 range with 0-based indexing: 1, 3, 5, 7, 9, 11, 13, 15, 17, 19")
