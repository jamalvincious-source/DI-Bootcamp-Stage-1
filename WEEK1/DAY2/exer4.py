# Lists, Floats, Integers, and Range Generation

print("=" * 60)
print("RECAP: Float vs Integer")
print("=" * 60)
print("Integer: A whole number without a decimal point (e.g., 2, 5, -10)")
print("Float: A number with a decimal point (e.g., 2.5, 3.14, -10.5)")
print("Key difference: Floats can represent fractional values, integers cannot")
print()

# Method 1: Using a loop with range and conditional logic
print("Method 1: Using a loop to generate the sequence")
print("-" * 60)
sequence_method1 = []
for i in range(1, 10):  # 1 to 9
    if i % 2 == 1:  # Odd numbers
        sequence_method1.append(float(i) + 0.5)  # Add .5 to odd numbers
    else:  # Even numbers
        sequence_method1.append(i)  # Keep even numbers as integers

print("Sequence:", sequence_method1)
print()

# Method 2: Using list comprehension with numpy-style approach
print("Method 2: Using a loop with step increments")
print("-" * 60)
sequence_method2 = []
current = 1.5
while current <= 5:
    sequence_method2.append(current)
    current += 0.5

print("Sequence:", sequence_method2)
print()

# Method 3: Using list comprehension with a more elegant approach
print("Method 3: Using list comprehension")
print("-" * 60)
sequence_method3 = [i/2 for i in range(3, 11)]  # Divide numbers 3-10 by 2
print("Sequence:", sequence_method3)
print()

# Verify all methods produce the same result
print("=" * 60)
print("Verification")
print("=" * 60)
target = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
print(f"Target sequence: {target}")
print(f"Method 1 matches: {sequence_method1 == target}")
print(f"Method 2 matches: {sequence_method2 == target}")
print(f"Method 3 matches: {sequence_method3 == target}")
print()

# Demonstrate type checking
print("=" * 60)
print("Type Checking")
print("=" * 60)
print("Types in the sequence:")
for num in target:
    print(f"  {num} -> type: {type(num).__name__}")
