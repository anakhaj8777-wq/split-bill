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
let paybacks = [];
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
    members: selectedIndexes,
    date: expense.expense_date
});
    });
    

    displayExpenses();
    calculateBalances();

    console.log("Expenses loaded from Supabase:", expenses);
}
async function loadPaymentsFromSupabase() {
    const { data, error } = await db
        .from("payments")
        .select("*")
        .eq("room_id", ROOM_ID)
        .order("id");

    if (error) {
        console.error("Payment loading error:", error);
        return;
    }

    payments = [];

    data.forEach(payment => {
        const paidByIndex = memberRecords.findIndex(
            member => Number(member.id) === Number(payment.paid_by)
        );

        if (paidByIndex !== -1) {
            payments.push({
            id: payment.id,
            paidBy: paidByIndex,
            category: payment.category,
            amount: Number(payment.amount),
            date: payment.payment_date
            });
        }
    });

    displayPayments();
    calculateBalances();
}
async function loadPaybacksFromSupabase() {

    const { data, error } = await db
        .from("paybacks")
        .select("*")
        .eq("room_id", ROOM_ID)
        .order("id");

    if (error) {
        console.error("Payback loading error:", error);
        return;
    }

    paybacks = data || [];

    console.log("Paybacks loaded from Supabase:", paybacks);
}
async function savePaybackStatus(debtorIndex, creditorIndex, category, amount, status) {

    const debtorId = memberRecords[debtorIndex].id;
    const creditorId = memberRecords[creditorIndex].id;

    const existing = paybacks.find(function (payback) {

        return (
            Number(payback.debtor_id) === Number(debtorId) &&
            Number(payback.creditor_id) === Number(creditorId) &&
            payback.category === category &&
            Math.abs(Number(payback.amount) - Number(amount)) < 0.01
        );

    });

    if (existing) {

        const { data, error } = await db
            .from("paybacks")
            .update({
                status: status,
                cleared_at:
                    status === "Cleared"
                        ? new Date().toISOString()
                        : null
            })
            .eq("id", existing.id)
            .select()
            .single();

        if (error) {
            console.error("Error updating payback:", error);
            alert("Payback status could not be updated.");
            return;
        }

        const index =
            paybacks.findIndex(function (item) {
                return item.id === existing.id;
            });

        if (index !== -1) {
            paybacks[index] = data;
        }

    } else {

        const { data, error } = await db
            .from("paybacks")
            .insert([
                {
                    room_id: ROOM_ID,
                    debtor_id: debtorId,
                    creditor_id: creditorId,
                    category: category,
                    amount: amount,
                    status: status,
                    cleared_at:
                        status === "Cleared"
                            ? new Date().toISOString()
                            : null
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Error saving payback:", error);
            alert("Payback status could not be saved.");
            return;
        }

        paybacks.push(data);
    }

    displayExpenses();
}
async function clearAllPaybacks() {

    const confirmClear = confirm(
        "Are you sure you want to delete all payback records?"
    );

    if (!confirmClear) {
        return;
    }

    const { error } = await db
        .from("paybacks")
        .delete()
        .eq("room_id", ROOM_ID);

    if (error) {
        console.error("Error clearing paybacks:", error);
        alert("Paybacks could not be cleared.");
        return;
    }

    paybacks = [];

    displayExpenses();
    displayMonthlyStatistics();

    const reminderList =
        document.getElementById("reminderList");

    if (reminderList) {
        reminderList.textContent =
            "No pending reminders yet.";
    }

    alert("All payback records have been cleared.");
}
function getPaybackStatus(
    debtorIndex,
    creditorIndex,
    category,
    amount
) {

    const debtorId =
        memberRecords[debtorIndex].id;

    const creditorId =
        memberRecords[creditorIndex].id;

    const existing =
        paybacks.find(function (payback) {

            return (
                Number(payback.debtor_id) === Number(debtorId) &&
                Number(payback.creditor_id) === Number(creditorId) &&
                payback.category === category &&
                Math.abs(
                    Number(payback.amount) -
                    Number(amount)
                ) < 0.01
            );

        });

    if (!existing) {
        return "Pending";
    }

    return existing.status;
}
document.addEventListener("DOMContentLoaded", async function () {

    setupMemberInputs();

    await loadMembersFromSupabase();

    await loadExpensesFromSupabase();
    await loadPaymentsFromSupabase();
    await loadPaybacksFromSupabase();

    updateExpenseMembers();
    updatePaymentDropdown();

    displayExpenses();
    displayPayments();
    calculateBalances();

    setupStatistics();
});

function updateMembers() {
    const inputs = document.querySelectorAll(".member-name");

    inputs.forEach(function (input, index) {
        if (members[index] !== undefined) {
            members[index] = input.value.trim() || `Person ${index + 1}`;
        }
    });
}

function setupMemberInputs() {

    const inputs =
        document.querySelectorAll(".member-name");

    inputs.forEach(function (input, index) {

        input.addEventListener("input", function () {

            updateMembers();
            updateExpenseMembers();
            updatePaymentDropdown();
            displayExpenses();
            displayPayments();
            calculateBalances();

        });

        input.addEventListener("change", async function () {

            const member =
                memberRecords[index];

            if (!member) {
                return;
            }

            const newName =
                input.value.trim();

            if (!newName) {
                return;
            }

            const { error } = await db
                .from("members")
                .update({
                    name: newName
                })
                .eq("id", member.id)
                .eq("room_id", ROOM_ID);

            if (error) {

                console.error(
                    "Error saving member name:",
                    error
                );

            } else {

                member.name = newName;
                members[index] = newName;

                updateExpenseMembers();
                updatePaymentDropdown();

            }

        });

    });

    const addExpenseButton =
        document.getElementById("addExpense");

    if (addExpenseButton) {
        addExpenseButton.addEventListener(
            "click",
            addExpense
        );
    }

    const addPaymentButton =
        document.getElementById("addPayment");

    if (addPaymentButton) {
        addPaymentButton.addEventListener(
            "click",
            addPayment
        );
    }

    const clearPaymentsButton =
        document.getElementById("clearPayments");

    if (clearPaymentsButton) {
        clearPaymentsButton.addEventListener(
            "click",
            clearAllPayments
        );
    }

    const clearExpensesButton =
        document.getElementById("clearExpenses");

    if (clearExpensesButton) {
        clearExpensesButton.addEventListener(
            "click",
            clearAllExpenses
        );
    }

    const clearPaybacksButton =
        document.getElementById("clearPaybacks");

    if (clearPaybacksButton) {
        clearPaybacksButton.addEventListener(
            "click",
            clearAllPaybacks
        );
    }
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
    members: selectedIndexes,
    date: data.expense_date
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
async function deleteExpense(id) {
    const { error } = await db
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("room_id", ROOM_ID);

    if (error) {
        console.error("Error deleting expense:", error);
        alert("Expense could not be deleted.");
        return;
    }

    expenses = expenses.filter(function (expense) {
        return expense.id !== id;
    });

    displayExpenses();
    calculateBalances();
}

async function clearAllExpenses() {

    const confirmClear = confirm(
        "Are you sure you want to delete all expenses and payback records?"
    );

    if (!confirmClear) {
        return;
    }

    const { error: expenseError } = await db
        .from("expenses")
        .delete()
        .eq("room_id", ROOM_ID);

    if (expenseError) {
        console.error("Error clearing expenses:", expenseError);
        alert("Expenses could not be cleared.");
        return;
    }

    const { error: paybackError } = await db
        .from("paybacks")
        .delete()
        .eq("room_id", ROOM_ID);

    if (paybackError) {
        console.error("Error clearing paybacks:", paybackError);
        alert("Expenses were cleared, but paybacks could not be cleared.");
        return;
    }

    expenses = [];
    paybacks = [];

    displayExpenses();
    calculateBalances();
    displayMonthlyStatistics();

    alert("All expenses and payback records have been cleared.");
}
function displayExpenses() {
    const container =
    document.getElementById(
        "expenseSections"
    );

if (!container) {
    return;
}

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

    const section = document.createElement("div");
    section.className = "category-settlement";

    const title = document.createElement("h4");
    title.textContent = "Who Pays Whom?";
    section.appendChild(title);

    const categoryExpenses = expenses.filter(function (expense) {
        return expense.type === category;
    });

    if (categoryExpenses.length === 0) {
        return section;
    }

    const personShares =
        new Array(members.length).fill(0);

    let categoryTotal = 0;

    categoryExpenses.forEach(function (expense) {

        if (
            !expense.members ||
            expense.members.length === 0
        ) {
            return;
        }

        const unitPrice =
            expense.amount / expense.members.length;

        categoryTotal += expense.amount;

        expense.members.forEach(function (memberIndex) {
            personShares[memberIndex] += unitPrice;
        });
    });

    const categoryPayments =
        payments.filter(function (payment) {
            return payment.category === category;
        });

    if (categoryPayments.length === 0) {

        const message =
            document.createElement("div");

        message.className = "category-empty";

        message.textContent =
            "Add the payment for this category to calculate who pays whom.";

        section.appendChild(message);

        return section;
    }

    const paidAmounts =
        new Array(members.length).fill(0);

    categoryPayments.forEach(function (payment) {

        paidAmounts[payment.paidBy] +=
            Number(payment.amount);

    });

    let mainPayerIndex = -1;
    let highestPayment = 0;

    paidAmounts.forEach(function (amount, index) {

        if (amount > highestPayment) {
            highestPayment = amount;
            mainPayerIndex = index;
        }

    });

    if (mainPayerIndex === -1) {
        return section;
    }

    const payerInfo =
        document.createElement("div");

    payerInfo.className =
        "settlement-row";

    payerInfo.innerHTML = `
        <strongconst payment>
            ${members[mainPayerIndex]}
        </strong>

        <span>
            paid the total
        </span>

        <strong>
            AED ${highestPayment.toFixed(2)}
        </strong>
    `;

    section.appendChild(payerInfo);

    let settlementTotal = 0;

    members.forEach(function (member, index) {

        if (index === mainPayerIndex) {
            return;
        }

        const amountOwed =
            personShares[index];

        if (amountOwed <= 0.005) {
            return;
        }

        const row =
            document.createElement("div");

        row.className =
            "settlement-row";

        const status =
            getPaybackStatus(
                index,
                mainPayerIndex,
                category,
                amountOwed
            );

        const statusButton =
            document.createElement("button");

        statusButton.textContent = status;

        statusButton.className =
            status === "Cleared"
                ? "payback-cleared-btn"
                : "payback-pending-btn";

        statusButton.addEventListener(
            "click",
            async function () {

                statusButton.disabled = true;

                const newStatus =
                    status === "Cleared"
                        ? "Pending"
                        : "Cleared";

                await savePaybackStatus(
                    index,
                    mainPayerIndex,
                    category,
                    amountOwed,
                    newStatus
                );

            }
        );

        row.innerHTML = `
            <strong>
                ${members[index]}
            </strong>

            <span>→</span>

            <strong>
                ${members[mainPayerIndex]}
            </strong>

            <span>
                AED ${amountOwed.toFixed(2)}
            </span>
        `;

        row.appendChild(statusButton);

        section.appendChild(row);

        settlementTotal += amountOwed;

    });

    const total =
        document.createElement("div");

    total.className =
        "settlement-total";

    total.innerHTML = `
        <span>
            Total to ${members[mainPayerIndex]}
        </span>

        <span>
            AED ${settlementTotal.toFixed(2)}
        </span>
    `;

    section.appendChild(total);

    const payerOwnShare =
        personShares[mainPayerIndex];

    const expectedTotal =
        categoryTotal - payerOwnShare;

    const paymentTotal =
    categoryPayments.reduce(function (total, payment) {
        return total + Number(payment.amount);
    }, 0);

const check =
    document.createElement("div");

check.className =
    "settlement-total";

let paymentCheckText = "";

if (Math.abs(paymentTotal - categoryTotal) < 0.01) {

    paymentCheckText =
        `Payment: ✅ Tally`;

} else if (paymentTotal < categoryTotal) {

    paymentCheckText =
        `Payment: ⚠️ AED ${(categoryTotal - paymentTotal).toFixed(2)} remaining`;

} else {

    paymentCheckText =
        `Payment: ⚠️ AED ${(paymentTotal - categoryTotal).toFixed(2)} extra`;
}

check.innerHTML = `
    <span>
        Calculation Check: AED ${expectedTotal.toFixed(2)}
    </span>

    <span>
        ${paymentCheckText}
    </span>
`;

section.appendChild(check);

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
                payment_date: new Date().toISOString().split("T")[0]
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
    amount: Number(data.amount),
    date: data.payment_date
});

    document.getElementById("paymentAmount").value = "";

    displayPayments();
    displayExpenses();
    calculateBalances();
}

async function deletePayment(id) {

    const { error } = await db
        .from("payments")
        .delete()
        .eq("id", id)
        .eq("room_id", ROOM_ID);

    if (error) {
        console.error("Error deleting payment:", error);
        alert("Payment could not be deleted.");
        return;
    }

    payments = payments.filter(function (payment) {
        return payment.id !== id;
    });

    displayPayments();
    displayExpenses();
    calculateBalances();
}
async function clearAllPayments() {

    const confirmClear = confirm(
        "Are you sure you want to delete all payments?"
    );

    if (!confirmClear) {
        return;
    }

    const { error } = await db
        .from("payments")
        .delete()
        .eq("room_id", ROOM_ID);

    if (error) {
        console.error("Error clearing payments:", error);
        alert("Payments could not be cleared.");
        return;
    }

    payments = [];

    displayPayments();
    displayExpenses();
    calculateBalances();
    displayMonthlyStatistics();

    alert("All payments have been cleared.");
}

function displayPayments() {

    const container =
    document.getElementById(
        "paymentList"
    );

if (!container) {
    return;
}

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
function setupStatistics() {

    const monthInput =
        document.getElementById("statisticsMonth");

    if (!monthInput) {
        return;
    }

    const today = new Date();

    const currentMonth =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0");

    monthInput.value = currentMonth;

    monthInput.addEventListener("change", function () {
        displayMonthlyStatistics();
    });

    displayMonthlyStatistics();
}
function displayMonthlyStatistics() {

    const monthInput =
        document.getElementById("statisticsMonth");

    const container =
        document.getElementById("monthlyStatistics");

    if (!monthInput || !container) {
        return;
    }

    const selectedMonth = monthInput.value;

    if (!selectedMonth) {
        container.innerHTML = `
            <div class="category-empty">
                Select a month to view statistics.
            </div>
        `;
        return;
    }

    const monthlyExpenses = expenses.filter(function (expense) {
        return expense.date &&
               expense.date.startsWith(selectedMonth);
    });

    const monthlyPayments = payments.filter(function (payment) {
        return payment.date &&
               payment.date.startsWith(selectedMonth);
    });

    let totalExpenses = 0;

    monthlyExpenses.forEach(function (expense) {
        totalExpenses += Number(expense.amount);
    });

    let totalPayments = 0;

    monthlyPayments.forEach(function (payment) {
        totalPayments += Number(payment.amount);
    });

    let categoryTotals = {};

    monthlyExpenses.forEach(function (expense) {

        if (!categoryTotals[expense.type]) {
            categoryTotals[expense.type] = 0;
        }

        categoryTotals[expense.type] +=
            Number(expense.amount);
    });

    let html = `
        <div class="statistics-summary">

            <div class="stat-box">
                <h3>Total Expenses</h3>
                <p>AED ${totalExpenses.toFixed(2)}</p>
            </div>

            <div class="stat-box">
                <h3>Actual Payments</h3>
                <p>AED ${totalPayments.toFixed(2)}</p>
            </div>

        </div>

        <h3>Category-wise Expenses</h3>
    `;

    if (Object.keys(categoryTotals).length === 0) {

        html += `
            <div class="category-empty">
                No expenses found for this month.
            </div>
        `;

    } else {

        html += `
            <div class="statistics-table-wrapper">
                <table class="statistics-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        Object.keys(categoryTotals).forEach(function (category) {

            html += `
                <tr>
                    <td>${category}</td>
                    <td>AED ${categoryTotals[category].toFixed(2)}</td>
                </tr>
            `;

        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }
    html += `
    <h3>Person-wise Expense Share</h3>

    <div class="statistics-table-wrapper">
        <table class="statistics-table">
            <thead>
                <tr>
                    <th>Person</th>
                    <th>Total Share</th>
                </tr>
            </thead>
            <tbody>
`;

members.forEach(function (member, index) {

    let personShare = 0;

    monthlyExpenses.forEach(function (expense) {

        if (
            expense.members &&
            expense.members.includes(index)
        ) {
            const unitPrice =
                Number(expense.amount) /
                expense.members.length;

            personShare += unitPrice;
        }

    });

    html += `
        <tr>
            <td>${member}</td>
            <td>AED ${personShare.toFixed(2)}</td>
        </tr>
    `;
});

html += `
            </tbody>
        </table>
    </div>
`;
html += `
    <h3>Actual Payment by Person</h3>

    <div class="statistics-table-wrapper">
        <table class="statistics-table">
            <thead>
                <tr>
                    <th>Person</th>
                    <th>Actual Paid</th>
                </tr>
            </thead>
            <tbody>
`;

members.forEach(function (member, index) {

    let actualPaid = 0;

    monthlyPayments.forEach(function (payment) {

        if (payment.paidBy === index) {
            actualPaid += Number(payment.amount);
        }

    });

    html += `
        <tr>
            <td>${member}</td>
            <td>AED ${actualPaid.toFixed(2)}</td>
        </tr>
    `;
});

html += `
            </tbody>
        </table>
    </div>
`;
const monthlyPaybacks = paybacks.filter(function (payback) {

    return payback.created_at &&
           payback.created_at.startsWith(selectedMonth);

});

let pendingAmount = 0;
let clearedAmount = 0;

monthlyPaybacks.forEach(function (payback) {

    if (payback.status === "Cleared") {
        clearedAmount += Number(payback.amount);
    } else {
        pendingAmount += Number(payback.amount);
    }

});

html += `
    <h3>Payback Status</h3>

    <div class="statistics-summary">

        <div class="stat-box">
            <h3>Pending</h3>
            <p>AED ${pendingAmount.toFixed(2)}</p>
        </div>

        <div class="stat-box">
            <h3>Cleared</h3>
            <p>AED ${clearedAmount.toFixed(2)}</p>
        </div>

    </div>
`;

    container.innerHTML = html;
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
    calculateOverallSettlement();
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

if (!container) {
    return;
}

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
const menuButton =
    document.getElementById("menuButton");

const sidebar =
    document.getElementById("sidebar");

const closeSidebar =
    document.getElementById("closeSidebar");


if (menuButton && sidebar) {

    menuButton.addEventListener(
        "click",
        function () {
            sidebar.classList.add("open");
        }
    );

}


if (closeSidebar && sidebar) {

    closeSidebar.addEventListener(
        "click",
        function () {
            sidebar.classList.remove("open");
        }
    );

}


document
    .querySelectorAll(".sidebar nav a")
    .forEach(function (link) {
        link.addEventListener(
            "click",
            function () {
                if (sidebar) {
                    sidebar.classList.remove("open");
                }
            }
        );
    });


/* CLOSE SIDEBAR WHEN CLICKING OUTSIDE */

document.addEventListener(
    "click",
    function (event) {

        if (!sidebar) {
            return;
        }

        if (!sidebar.classList.contains("open")) {
            return;
        }

        const clickedInsideSidebar =
            sidebar.contains(event.target);

        const clickedMenuButton =
            menuButton &&
            menuButton.contains(event.target);

        if (
            !clickedInsideSidebar &&
            !clickedMenuButton
        ) {
            sidebar.classList.remove("open");
        }

    }
);
function calculateOverallSettlement() {

    const container =
        document.getElementById("overallSettlement");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const shouldPay =
        new Array(members.length).fill(0);

    const actuallyPaid =
        new Array(members.length).fill(0);


    expenses.forEach(function (expense) {

        if (
            !expense.members ||
            expense.members.length === 0
        ) {
            return;
        }

        const share =
            Number(expense.amount) /
            expense.members.length;

        expense.members.forEach(function (index) {

            shouldPay[index] += share;

        });

    });


    payments.forEach(function (payment) {

        if (
            payment.paidBy >= 0 &&
            payment.paidBy < members.length
        ) {

            actuallyPaid[payment.paidBy] +=
                Number(payment.amount);

        }

    });


    const receivers = [];
    const debtors = [];


    members.forEach(function (member, index) {

        const balance =
            actuallyPaid[index] -
            shouldPay[index];


        if (balance > 0.005) {

            receivers.push({
                index: index,
                amount: balance
            });

        } else if (balance < -0.005) {

            debtors.push({
                index: index,
                amount: Math.abs(balance)
            });

        }

    });


    if (
        receivers.length === 0 &&
        debtors.length === 0
    ) {

        container.innerHTML = `
            <div class="category-empty">
                Everyone is settled.
            </div>
        `;

        return;
    }


    let debtorIndex = 0;
    let receiverIndex = 0;
    let totalSettlement = 0;


    while (
        debtorIndex < debtors.length &&
        receiverIndex < receivers.length
    ) {

        const debtor =
            debtors[debtorIndex];

        const receiver =
            receivers[receiverIndex];


        const amount =
            Math.min(
                debtor.amount,
                receiver.amount
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
                ${members[receiver.index]}
            </strong>

            <span>
                AED ${amount.toFixed(2)}
            </span>
        `;


        container.appendChild(row);


        totalSettlement += amount;


        debtor.amount -= amount;
        receiver.amount -= amount;


        if (debtor.amount <= 0.005) {
            debtorIndex++;
        }


        if (receiver.amount <= 0.005) {
            receiverIndex++;
        }

    }


    const total =
        document.createElement("div");

    total.className =
        "settlement-total";


    total.innerHTML = `
        <span>
            Total settlement
        </span>

        <span>
            AED ${totalSettlement.toFixed(2)}
        </span>
    `;


    container.appendChild(total);

}



    
   
