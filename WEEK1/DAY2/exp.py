# Exercise: Loop from 1500 to 2500 and print multiples of 5 and 7

print("=" * 60)
print("Multiples of 5 and 7 (from 1500 to 2500)")
print("=" * 60)
print()

# Method 1: Multiples of BOTH 5 and 7 (i.e., multiples of 35)
print("Method 1: Multiples of both 5 AND 7 (divisible by 35)")
print("-" * 60)
multiples_both = []
for num in range(1500, 2501):  # 1500 to 2500 inclusive
    if num % 5 == 0 and num % 7 == 0:
        multiples_both.append(num)
        print(num, end=" ")

print(f"\n\nCount: {len(multiples_both)}")
print()

# Method 2: Multiples of 5 OR 7
print("=" * 60)
print("Method 2: Multiples of 5 OR 7")
print("-" * 60)
multiples_or = []
for num in range(1500, 2501):
    if num % 5 == 0 or num % 7 == 0:
        multiples_or.append(num)

print(f"First 20 multiples: {multiples_or[:20]}")
print(f"Last 20 multiples: {multiples_or[-20:]}")
print(f"\nTotal count: {len(multiples_or)}")
print()

# Method 3: Using range with step (more efficient for multiples of 35)
print("=" * 60)
print("Method 3: Using range with step (multiples of 35)")
print("-" * 60)
# Find first multiple of 35 >= 1500
start = 1500
while start % 35 != 0:
    start += 1

multiples_step = []
for num in range(start, 2501, 35):  # Step by 35
    multiples_step.append(num)
    print(num, end=" ")

print(f"\n\nCount: {len(multiples_step)}")
print()

# Verify Methods 1 and 3 produce same result
print("=" * 60)
print("Verification")
print("=" * 60)
print(f"Method 1 and Method 3 match: {multiples_both == multiples_step}")
