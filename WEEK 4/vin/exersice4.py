def sum_list(numbers):
    total = 0
    for number in numbers:
        total += number
    return total


print(sum_list([1, 2, 3, 4]))
print(sum_list([5, 5, 5]))
print(sum_list([1, 2, 3, 4]))  # 10
print(sum_list([5, 5, 5]))     # 15