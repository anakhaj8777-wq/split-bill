const SUPABASE_URL = "https://pgeyvaamajrlflzqsxem.supabase.co";
const SUPABASE_KEY = "sb_publishable_AtF2vusLSQ6fmF_j7v8GCg_ag17dhbC";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
const categories = [
    "Grocery",
    "Food",
    "Taxi",
    "Entertainment",
    "Hospital",
    "Pharmacy",
    "WiFi",
    "Water",
    "Gas",
    "Other"
];
const ROOM_ID = 4;

let memberRecords = [];
let members = [
    "Person 1",
    "Person 2",
    "Person 3",
    "Person 4",
    "Person 5",
    "Person 6"
];

let expenses = [];
let payments = [];
async function loadMembersFromSupabase() {
    const { data, error } = await db
        .from("members")
        .select("id, name")
        .eq("room_id", ROOM_ID)
        .order("id");

    if (error) {
        console.error("Error loading members:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No members found in Supabase.");
        return;
    }

    memberRecords = data;

    const inputs = document.querySelectorAll(".member-name");

    data.forEach(function (member, index) {
        if (inputs[index]) {
            inputs[index].value = member.name;
        }

        members[index] = member.name;
    });

    updateExpenseMembers();
    updatePaymentDropdown();
    displayExpenses();
    displayPayments();
    calculateBalances();

    console.log("Members loaded:", memberRecords);
}
async function loadExpensesFromSupabase() {
    const { data, error } = await db
        .from("expenses")
        .select("*")
        .eq("room_id", ROOM_ID)
        .order("id");

    if (error) {
        console.error("Error loading expenses:", error);
        return;
    }

    expenses = [];

    data.forEach(function (expense) {
        const selectedIndexes = [];

        if (Array.isArray(expense.shared_member_ids)) {
            expense.shared_member_ids.forEach(function (memberId) {
                const index = memberRecords.findIndex(function (member) {
                    return Number(member.id) === Number(memberId);
                });

                if (index !== -1) {
                    selectedIndexes.push(index);
                }
            });
        }

        expenses.push({
            id: expense.id,
            type: expense.category,
            description: expense.item,
            amount: Number(expense.amount),
            members: selectedIndexes
        });
    });

    displayExpenses();
    calculateBalances();

    console.log("Expenses loaded from Supabase:", expenses);
}
document.addEventListener("DOMContentLoaded", async function () {
    setupMemberInputs();

    await loadMembersFromSupabase();

    await loadExpensesFromSupabase();

    updateExpenseMembers();
    updatePaymentDropdown();
    displayExpenses();
    displayPayments();
    calculateBalances();
});
function setupMemberInputs() {
    const inputs =
        document.querySelectorAll(".member-name");

    inputs.forEach(function (input) {
        input.addEventListener("input", function () {
            updateMembers();
            updateExpenseMembers();
            updatePaymentDropdown();
            displayExpenses();
            displayPayments();
            calculateBalances();
        });
    });

    document
        .getElementById("addExpense")
        .addEventListener("click", addExpense);

    document
        .getElementById("addPayment")
        .addEventListener("click", addPayment);
}

function updateMembers() {
    const inputs =
        document.querySelectorAll(".member-name");

    inputs.forEach(function (input, index) {
        const name = input.value.trim();

        if (name !== "") {
            members[index] = name;
        }
    });
}

function updateExpenseMembers() {
    members.forEach(function (member, index) {
        const element =
            document.getElementById(
                "expenseMember" + index
            );

        if (element) {
            element.textContent = member;
        }
    });
}

function updatePaymentDropdown() {
    const paidBy =
        document.getElementById("paidBy");

    if (!paidBy) {
        return;
    }

    const currentValue = paidBy.value;

    paidBy.innerHTML = "";

    members.forEach(function (member, index) {
        const option =
            document.createElement("option");

        option.value = index;
        option.textContent = member;

        paidBy.appendChild(option);
    });

    if (currentValue !== "") {
        paidBy.value = currentValue;
    }
}

async function addExpense() {
    updateMembers();

    const type = document.getElementById("expenseType").value;
    const description = document.getElementById("expenseDescription").value.trim();
    const amount = parseFloat(document.getElementById("expenseAmount").value);

    if (type === "") {
        alert("Please select an expense type.");
        return;
    }

    if (description === "") {
        alert("Please enter an item or description.");
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const selectedIndexes = [];

    document.querySelectorAll(".expense-member").forEach(function (checkbox) {
        if (checkbox.checked) {
            selectedIndexes.push(parseInt(checkbox.value));
        }
    });

    if (selectedIndexes.length === 0) {
        alert("Please select at least one person.");
        return;
    }

    const selectedMemberIds = selectedIndexes.map(function (index) {
        return memberRecords[index].id;
    });

    const { data, error } = await db
        .from("expenses")
        .insert([
            {
                room_id: ROOM_ID,
                item: description,
                category: type,
                amount: amount,
                paid_by: null,
                expense_date: new Date().toISOString().split("T")[0],
                shared_member_ids: selectedMemberIds
            }
        ])
        .select()
        .single();

    if (error) {
        console.error("Error saving expense:", error);
        alert("Expense could not be saved. Check the browser console.");
        return;
    }

    console.log("Expense saved to Supabase:", data);

    const newExpense = {
        id: data.id,
        type: data.category,
        description: data.item,
        amount: Number(data.amount),
        members: selectedIndexes
    };

    expenses.push(newExpense);

    document.getElementById("expenseDescription").value = "";
    document.getElementById("expenseAmount").value = "";

    document.querySelectorAll(".expense-member").forEach(function (checkbox) {
        checkbox.checked = false;
    });

    displayExpenses();
    calculateBalances();
}
function deleteExpense(id) {
    expenses =
        expenses.filter(function (expense) {
            return expense.id !== id;
        });

    displayExpenses();
    calculateBalances();
}

function displayExpenses() {
    const container =
        document.getElementById(
            "expenseSections"
        );

    container.innerHTML = "";

    if (expenses.length === 0) {
        container.innerHTML = `
            <div class="category-empty">
                No expenses added yet.
            </div>
        `;

        return;
    }

    categories.forEach(function (category) {

        const categoryExpenses =
            expenses.filter(function (expense) {
                return expense.type === category;
            });

        if (categoryExpenses.length === 0) {
            return;
        }

        const section =
            document.createElement("div");

        section.className =
            "expense-category";

        const header =
            document.createElement("div");

        header.className =
            "category-header";

        header.innerHTML =
            `<h3>${category}</h3>`;

        section.appendChild(header);

        section.appendChild(
            createCategoryTable(
                categoryExpenses
            )
        );

        section.appendChild(
            createCategorySettlement(
                category
            )
        );

        container.appendChild(section);
    });
}

function createCategoryTable(categoryExpenses) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "table-wrapper";

    const table =
        document.createElement("table");

    table.className =
        "category-table";

    const thead =
        document.createElement("thead");

    const headerRow =
        document.createElement("tr");

    const descriptionHeader =
        document.createElement("th");

    descriptionHeader.textContent =
        "Item / Description";

    headerRow.appendChild(
        descriptionHeader
    );

    members.forEach(function (member) {

        const th =
            document.createElement("th");

        th.textContent = member;

        headerRow.appendChild(th);
    });

    const totalHeader =
        document.createElement("th");

    totalHeader.textContent =
        "Total Amount";

    headerRow.appendChild(totalHeader);

    const unitHeader =
        document.createElement("th");

    unitHeader.textContent =
        "Unit Price";

    headerRow.appendChild(unitHeader);

    const actionHeader =
        document.createElement("th");

    actionHeader.textContent =
        "Action";

    headerRow.appendChild(actionHeader);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody =
        document.createElement("tbody");

    const personTotals =
        new Array(members.length).fill(0);

    let categoryTotal = 0;

    categoryExpenses.forEach(function (expense) {

        const row =
            document.createElement("tr");

        const descriptionCell =
            document.createElement("td");

        descriptionCell.textContent =
            expense.description;

        row.appendChild(descriptionCell);

        const unitPrice =
            expense.amount /
            expense.members.length;

        members.forEach(function (member, index) {

            const cell =
                document.createElement("td");

            if (
                expense.members.includes(index)
            ) {
                cell.textContent =
                    "AED " +
                    unitPrice.toFixed(2);

                personTotals[index] +=
                    unitPrice;
            } else {
                cell.textContent = "-";
            }

            row.appendChild(cell);
        });

        const totalCell =
            document.createElement("td");

        totalCell.textContent =
            "AED " +
            expense.amount.toFixed(2);

        row.appendChild(totalCell);

        const unitCell =
            document.createElement("td");

        unitCell.textContent =
            "AED " +
            unitPrice.toFixed(2);

        row.appendChild(unitCell);

        const actionCell =
            document.createElement("td");

        const deleteButton =
            document.createElement("button");

        deleteButton.textContent =
            "Delete";

        deleteButton.className =
            "delete-btn";

        deleteButton.addEventListener(
            "click",
            function () {
                deleteExpense(expense.id);
            }
        );

        actionCell.appendChild(
            deleteButton
        );

        row.appendChild(actionCell);

        tbody.appendChild(row);

        categoryTotal += expense.amount;
    });

    table.appendChild(tbody);

    const tfoot =
        document.createElement("tfoot");

    const totalRow =
        document.createElement("tr");

    const totalLabel =
        document.createElement("td");

    totalLabel.textContent =
        "Category Total";

    totalRow.appendChild(totalLabel);

    personTotals.forEach(function (total) {

        const cell =
            document.createElement("td");

        cell.textContent =
            "AED " +
            total.toFixed(2);

        totalRow.appendChild(cell);
    });

    const totalCell =
        document.createElement("td");

    totalCell.textContent =
        "AED " +
        categoryTotal.toFixed(2);

    totalRow.appendChild(totalCell);

    const blankUnit =
        document.createElement("td");

    blankUnit.textContent = "-";

    totalRow.appendChild(blankUnit);

    const blankAction =
        document.createElement("td");

    blankAction.textContent = "-";

    totalRow.appendChild(blankAction);

    tfoot.appendChild(totalRow);
    table.appendChild(tfoot);

    wrapper.appendChild(table);

    return wrapper;
}

function createCategorySettlement(category) {

    const section =
        document.createElement("div");

    section.className =
        "category-settlement";

    const title =
        document.createElement("h4");

    title.textContent =
        "Who Pays Whom?";

    section.appendChild(title);

    const categoryExpenses =
        expenses.filter(function (expense) {
            return expense.type === category;
        });

    const shouldPay =
        new Array(members.length).fill(0);

    const actuallyPaid =
        new Array(members.length).fill(0);

    categoryExpenses.forEach(function (expense) {

        const unitPrice =
            expense.amount /
            expense.members.length;

        expense.members.forEach(
            function (memberIndex) {
                shouldPay[memberIndex] +=
                    unitPrice;
            }
        );
    });

    payments
        .filter(function (payment) {
            return payment.category === category;
        })
        .forEach(function (payment) {
            actuallyPaid[payment.paidBy] +=
                payment.amount;
        });

    const balances =
        new Array(members.length).fill(0);

    members.forEach(function (member, index) {

        balances[index] =
            actuallyPaid[index] -
            shouldPay[index];
    });

    const creditors = [];
    const debtors = [];

    balances.forEach(function (balance, index) {

        if (balance > 0.005) {
            creditors.push({
                index: index,
                amount: balance
            });
        }

        if (balance < -0.005) {
            debtors.push({
                index: index,
                amount: Math.abs(balance)
            });
        }
    });

    let settlementTotal = 0;

    if (
        creditors.length === 0 &&
        debtors.length === 0
    ) {

        const empty =
            document.createElement("div");

        empty.className =
            "category-empty";

        empty.textContent =
            "Everyone is settled.";

        section.appendChild(empty);

        return section;
    }

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (
        debtorIndex < debtors.length &&
        creditorIndex < creditors.length
    ) {

        const debtor =
            debtors[debtorIndex];

        const creditor =
            creditors[creditorIndex];

        const amount =
            Math.min(
                debtor.amount,
                creditor.amount
            );

        const row =
            document.createElement("div");

        row.className =
            "settlement-row";

        row.innerHTML = `
            <strong>
                ${members[debtor.index]}
            </strong>

            <span>→</span>

            <strong>
                ${members[creditor.index]}
            </strong>

            <span>
                AED ${amount.toFixed(2)}
            </span>
        `;

        section.appendChild(row);

        settlementTotal += amount;

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount <= 0.005) {
            debtorIndex++;
        }

        if (creditor.amount <= 0.005) {
            creditorIndex++;
        }
    }

    const total =
        document.createElement("div");

    total.className =
        "settlement-total";

    total.innerHTML = `
        <span>Total</span>
        <span>
            AED ${settlementTotal.toFixed(2)}
        </span>
    `;

    section.appendChild(total);

    return section;
}

async function addPayment() {
    updateMembers();

    const paidByIndex = parseInt(
        document.getElementById("paidBy").value
    );

    const category =
        document.getElementById("paymentCategory").value;

    const amount =
        parseFloat(
            document.getElementById("paymentAmount").value
        );

    if (isNaN(paidByIndex)) {
        alert("Please select who paid.");
        return;
    }

    if (category === "") {
        alert("Please select a category.");
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const paidByMemberId = memberRecords[paidByIndex].id;

    const { data, error } = await db
        .from("payments")
        .insert([
            {
                room_id: ROOM_ID,
                category: category,
                amount: amount,
                paid_by: paidByMemberId,
                shared_member_ids: []
            }
        ])
        .select()
        .single();

    if (error) {
    console.error("Payment error code:", error.code);
    console.error("Payment error message:", error.message);
    console.error("Payment error details:", error.details);
    console.error("Payment error hint:", error.hint);

    alert("Payment could not be saved. Open Console and check the error.");
    return;
}

    console.log("Payment saved to Supabase:", data);

    payments.push({
        id: data.id,
        paidBy: paidByIndex,
        category: data.category,
        amount: Number(data.amount)
    });

    document.getElementById("paymentAmount").value = "";

    displayPayments();
    displayExpenses();
    calculateBalances();
}

function deletePayment(id) {

    payments =
        payments.filter(function (payment) {
            return payment.id !== id;
        });

    displayPayments();
    displayExpenses();
    calculateBalances();
}

function displayPayments() {

    const container =
        document.getElementById(
            "paymentList"
        );

    container.innerHTML = "";

    if (payments.length === 0) {
        container.innerHTML = `
            <div class="category-empty">
                No payments recorded yet.
            </div>
        `;

        return;
    }

    payments.forEach(function (payment) {

        const row =
            document.createElement("div");

        row.className =
            "payment-row";

        row.innerHTML = `
            <span>
                ${members[payment.paidBy]}
            </span>

            <span>
                ${payment.category}
            </span>

            <span>
                AED ${payment.amount.toFixed(2)}
            </span>
        `;

        const deleteButton =
            document.createElement("button");

        deleteButton.textContent =
            "Delete";

        deleteButton.className =
            "delete-btn";

        deleteButton.addEventListener(
            "click",
            function () {
                deletePayment(payment.id);
            }
        );

        row.appendChild(deleteButton);

        container.appendChild(row);
    });
}

function calculateBalances() {

    const shouldPay =
        new Array(members.length).fill(0);

    const actuallyPaid =
        new Array(members.length).fill(0);

    expenses.forEach(function (expense) {

        const unitPrice =
            expense.amount /
            expense.members.length;

        expense.members.forEach(
            function (index) {
                shouldPay[index] +=
                    unitPrice;
            }
        );
    });

    payments.forEach(function (payment) {

        actuallyPaid[payment.paidBy] +=
            payment.amount;
    });

    const balances =
        members.map(function (member, index) {

            return (
                actuallyPaid[index] -
                shouldPay[index]
            );
        });

    displayFinalBalances(
        shouldPay,
        actuallyPaid,
        balances
    );
}

function displayFinalBalances(
    shouldPay,
    actuallyPaid,
    balances
) {

    const container =
        document.getElementById(
            "balanceList"
        );

    container.innerHTML = "";

    members.forEach(function (member, index) {

        const row =
            document.createElement("div");

        row.className =
            "balance-row";

        let status;

        if (balances[index] > 0.005) {

            status = `
                <span class="receive">
                    Receive AED
                    ${balances[index].toFixed(2)}
                </span>
            `;

        } else if (balances[index] < -0.005) {

            status = `
                <span class="pay">
                    Pay AED
                    ${Math.abs(
                        balances[index]
                    ).toFixed(2)}
                </span>
            `;

        } else {

            status = `
                <span class="settled">
                    Settled
                </span>
            `;
        }

        row.innerHTML = `
            <strong>${member}</strong>

            <span>
                Should Pay:
                AED ${shouldPay[index].toFixed(2)}
            </span>

            <span>
                Actually Paid:
                AED ${actuallyPaid[index].toFixed(2)}
            </span>

            ${status}
        `;

        container.appendChild(row);
    });
}
