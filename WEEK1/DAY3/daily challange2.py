items_purchase = {
	"Water": "$1",
	"Bread": "$3",
	"TV": "$1,000",
	"Fertilizer": "$20",
}
wallet = "$300"

wallet_amount = int(wallet.replace("$", "").replace(",", ""))
basket = []

for item, price in items_purchase.items():
	item_price = int(price.replace("$", "").replace(",", ""))

	if item_price <= wallet_amount:
		basket.append(item)
		wallet_amount -= item_price

if basket:
	print(sorted(basket))
else:
	print("Nothing")
