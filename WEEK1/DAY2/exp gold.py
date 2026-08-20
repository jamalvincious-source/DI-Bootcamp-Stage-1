# Exercise 1: Concatenate Lists Without Using +
# Instructions: Write code that concatenates two lists together without using the + sign.

print("=" * 60)
print("Concatenating Lists (without using +)")
print("=" * 60)
print()

# Initialize two lists
list1 = [1, 2, 3]
list2 = [4, 5, 6]

print(f"List 1: {list1}")
print(f"List 2: {list2}")
print()

# Method 1: Using extend()
print("Method 1: Using extend()")
print("-" * 60)
result1 = list1.copy()  # Create a copy to avoid modifying original
result1.extend(list2)
print(f"Result: {result1}")
print()

# Method 2: Using unpacking operator (*)
print("Method 2: Using unpacking operator (*)")
print("-" * 60)
result2 = [*list1, *list2]
print(f"Result: {result2}")
print()

# Method 3: Using list comprehension
print("Method 3: Using list comprehension")
print("-" * 60)
result3 = [item for item in list1] + [item for item in list2]
# Wait, this uses +, so let me fix it
result3 = []
for item in list1:
    result3.append(item)
for item in list2:
    result3.append(item)
print(f"Result: {result3}")
print()

# Method 4: Using a loop with append()
print("Method 4: Using loop with append()")
print("-" * 60)
result4 = []
for item in list1:
    result4.append(item)
for item in list2:
    result4.append(item)
print(f"Result: {result4}")
print()

# Method 5: Using itertools.chain()
print("Method 5: Using itertools.chain()")
print("-" * 60)
from itertools import chain
result5 = list(chain(list1, list2))
print(f"Result: {result5}")
print()

# Method 6: Using list() constructor with unpacking
print("Method 6: Using list() with unpacking")
print("-" * 60)
result6 = list([*list1, *list2])
print(f"Result: {result6}")
print()

# Verify all methods produce the same result
print("=" * 60)
print("Verification: All methods produce the same result")
print("=" * 60)
expected = [1, 2, 3, 4, 5, 6]
print(f"Expected result: {expected}")
print(f"Method 1 (extend): {result1 == expected}")
print(f"Method 2 (unpacking): {result2 == expected}")
print(f"Method 3 (list comprehension): {result3 == expected}")
print(f"Method 4 (loop with append): {result4 == expected}")
print(f"Method 5 (itertools.chain): {result5 == expected}")
print(f"Method 6 (list with unpacking): {result6 == expected}")
