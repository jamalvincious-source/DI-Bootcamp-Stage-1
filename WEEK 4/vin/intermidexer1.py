def find_largest(numbers):
    largest = numbers[0]
    for number in numbers[1:]:
        if number > largest:
            largest = number
    return largest


print(find_largest([1, 2, 3, 4]))
print(find_largest([10, 20, 5]))

