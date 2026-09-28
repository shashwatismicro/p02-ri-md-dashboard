sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (
    Controller,
    MessageToast,
    Filter,
    FilterOperator
) => {
    "use strict";

    return Controller.extend(
        "com.oswal.managementcockpit.managementcockpit.controller.Dashboard",
        {
            onInit() {
                const oToday = new Date();

                const iCurrentFiscalYear =
                    oToday.getMonth() + 1 >= 4
                        ? oToday.getFullYear()
                        : oToday.getFullYear() - 1;

                this.byId("fiscalYearSelect").setSelectedKey(
                    String(iCurrentFiscalYear)
                );

                this.byId("periodSelect").setSelectedKey(
                    String(oToday.getMonth() + 1).padStart(2, "0")
                );

                this._setRevenueMonthVisibility(
                    iCurrentFiscalYear,
                    oToday
                );

                /*
                 * Live loading is attempted automatically.
                 * Until the client-100 proxy/destination is configured,
                 * the local preview may show a service-loading message.
                 
                this._loadDashboardData(
                    iCurrentFiscalYear,
                    oToday.getMonth() + 1
                ); */
            },

            async onApplyFilters() {
                const sCompanyCode =
                    this.byId("companyCodeSelect").getSelectedKey();

                const sPlant =
                    this.byId("plantSelect").getSelectedKey();

                const iFiscalYear = Number(
                    this.byId("fiscalYearSelect").getSelectedKey()
                );

                const iPeriod = Number(
                    this.byId("periodSelect").getSelectedKey()
                );

                const oPeriodEndDate = this._getPeriodEndDate(
                    iFiscalYear,
                    iPeriod
                );

                const oToday = new Date();

                /*
                 * Compare at month level so that the current month
                 * remains selectable even before month-end.
                 */
                const oSelectedMonth = new Date(
                    oPeriodEndDate.getFullYear(),
                    oPeriodEndDate.getMonth(),
                    1
                );

                const oCurrentMonth = new Date(
                    oToday.getFullYear(),
                    oToday.getMonth(),
                    1
                );

                if (oSelectedMonth > oCurrentMonth) {
                    MessageToast.show(
                        "Future periods cannot be selected because revenue is not yet available."
                    );
                    return;
                }

                /*
                 * If the current period is selected, use today as the
                 * cutoff/key date rather than a future month-end date.
                 */
                const oEffectiveKeyDate =
                    oPeriodEndDate > oToday
                        ? oToday
                        : oPeriodEndDate;

                this._setRevenueMonthVisibility(
                    iFiscalYear,
                    oEffectiveKeyDate
                );

                const sPlantText =
                    sPlant === "ALL"
                        ? "All Plants"
                        : sPlant;

                const oSelectedPeriodItem =
                    this.byId("periodSelect").getSelectedItem();

                const sPeriodText =
                    oSelectedPeriodItem
                        ? oSelectedPeriodItem.getText()
                        : String(iPeriod);

                this.byId("dashboardCompanyText").setText(
                    `Company Code: ${sCompanyCode} | Plant: ${sPlantText} | FY ${iFiscalYear} | Period: ${sPeriodText}`
                );

                /*
                 * Sales and Revenue use Fiscal Year, Period,
                 * Company Code and Plant.
                 *
                 * AR and AP use Company Code, Profit Center/Plant,
                 * and the derived key date.
                 *
                 * AR and AP deliberately do not receive any
                 * accounting-document Fiscal Year filter.
                 */
                await this._loadDashboardData(
                    iFiscalYear,
                    iPeriod
                );
            },

            async _loadDashboardData(
                iFiscalYear,
                iPeriod
            ) {
                const oView = this.getView();
                const oModel = oView.getModel();

                if (!oModel) {
                    MessageToast.show(
                        "Management Cockpit OData model is not available."
                    );
                    return;
                }

                const sCompanyCode =
                    this.byId("companyCodeSelect").getSelectedKey();

                const sPlant =
                    this.byId("plantSelect").getSelectedKey();

                const oToday = new Date();

                const oFiscalYearStart = new Date(
                    iFiscalYear,
                    3,
                    1
                );

                const oSelectedPeriodEnd =
                    this._getPeriodEndDate(
                        iFiscalYear,
                        iPeriod
                    );

                const oEffectiveKeyDate =
                    oSelectedPeriodEnd > oToday
                        ? oToday
                        : oSelectedPeriodEnd;

                const sFiscalYearStart =
                    this._formatDateForOData(
                        oFiscalYearStart
                    );

                const sEffectiveKeyDate =
                    this._formatDateForOData(
                        oEffectiveKeyDate
                    );

                const aSalesFilters = [
                    new Filter(
                        "CompanyCode",
                        FilterOperator.EQ,
                        sCompanyCode
                    ),
                    new Filter(
                        "BillingDocumentDate",
                        FilterOperator.BT,
                        sFiscalYearStart,
                        sEffectiveKeyDate
                    )
                ];

                if (sPlant !== "ALL") {
                    aSalesFilters.push(
                        new Filter(
                            "Plant",
                            FilterOperator.EQ,
                            sPlant
                        )
                    );
                }

                oView.setBusy(true);

                try {
                    const [
                        aSalesData,
                        aReceivableData,
                        aPayableData
                    ] = await Promise.all([
                        this._requestCollection(
                            "/Sales",
                            aSalesFilters
                        ),
                        this._requestCollection(
                            `/AccountsReceivable/${sEffectiveKeyDate}/Set`,
                            this._getAccountingFilters(
                                sCompanyCode,
                                sPlant
                            )
                        ),
                        this._requestCollection(
                            `/AccountsPayable/${sEffectiveKeyDate}/Set`,
                            this._getAccountingFilters(
                                sCompanyCode,
                                sPlant
                            )
                        )
                    ]);

                    this._updateSalesAndRevenueKPIs(
                        aSalesData
                    );

                    this._updateAccountingKPIs(
                        aReceivableData,
                        aPayableData
                    );

                    this._updateTopCustomers(
                        aSalesData
                    );

                    this._updateMonthlyRevenue(
                        aSalesData,
                        iFiscalYear,
                        oEffectiveKeyDate
                    );

                    this._setLiveDataStatuses();

                    MessageToast.show(
                        "Live Management Cockpit data loaded successfully."
                    );
                } catch (oError) {
                    console.error(
                        "Management Cockpit data loading failed:",
                        oError
                    );

                    MessageToast.show(
                        "Live data could not be loaded. Check the client-100 destination or proxy configuration."
                    );
                } finally {
                    oView.setBusy(false);
                }
            },

            _getAccountingFilters(
                sCompanyCode,
                sPlant
            ) {
                const aFilters = [
                    new Filter(
                        "CompanyCode",
                        FilterOperator.EQ,
                        sCompanyCode
                    )
                ];

                /*
                 * The ageing views expose ProfitCenter rather than Plant.
                 * Current mapping uses the selected Plant code as
                 * ProfitCenter because the verified client-100 rows
                 * show values such as OC01.
                 */
                if (sPlant !== "ALL") {
                    aFilters.push(
                        new Filter(
                            "ProfitCenter",
                            FilterOperator.EQ,
                            sPlant
                        )
                    );
                }

                /*
                 * No FiscalYear filter is added here.
                 * This is mandatory for AR and AP.
                 */
                return aFilters;
            },

            async _requestCollection(
                sPath,
                aFilters = []
            ) {
                const oModel = this.getView().getModel();

                const oListBinding = oModel.bindList(
                    sPath,
                    null,
                    null,
                    aFilters,
                    {
                        "$count": true
                    }
                );

                const aAllResults = [];
                const iPageSize = 1000;
                let iStart = 0;
                let bMoreData = true;

                while (bMoreData) {
                    const aContexts =
                        await oListBinding.requestContexts(
                            iStart,
                            iPageSize
                        );

                    const aPageData =
                        aContexts.map(
                            (oContext) =>
                                oContext.getObject()
                        );

                    aAllResults.push(...aPageData);

                    bMoreData =
                        aContexts.length === iPageSize;

                    iStart += iPageSize;
                }

                oListBinding.destroy();

                return aAllResults;
            },

            _updateSalesAndRevenueKPIs(
                aSalesData
            ) {
                const nTotalGrossWeightKG =
                    aSalesData.reduce(
                        (nTotal, oRow) =>
                            nTotal +
                            this._toNumber(
                                oRow.GrossWeightInKG
                            ),
                        0
                    );

                const nTotalSalesMT =
                    nTotalGrossWeightKG / 1000;

                const nTotalRevenue =
                    aSalesData.reduce(
                        (nTotal, oRow) =>
                            nTotal +
                            this._toNumber(
                                oRow.NetAmount
                            ),
                        0
                    );

                this.byId("totalSalesValue").setNumber(
                    this._formatNumber(
                        nTotalSalesMT,
                        2
                    )
                );

                this.byId("totalSalesValue").setUnit(
                    "MT"
                );

                this.byId("totalRevenueValue").setNumber(
                    this._formatCrores(
                        nTotalRevenue
                    )
                );

                this.byId("totalRevenueValue").setUnit(
                    "Cr"
                );
            },

            _updateAccountingKPIs(
                aReceivableData,
                aPayableData
            ) {
                const nTotalReceivable =
                    aReceivableData.reduce(
                        (nTotal, oRow) =>
                            nTotal +
                            this._toNumber(
                                oRow.AccountsReceivable
                            ),
                        0
                    );

                const nTotalPayable =
                    aPayableData.reduce(
                        (nTotal, oRow) =>
                            nTotal +
                            this._toNumber(
                                oRow.AccountsPayable
                            ),
                        0
                    );

                /*
                 * Existing signed values are summed directly.
                 * No additional sign reversal is applied.
                 */
                this.byId(
                    "accountsReceivableValue"
                ).setNumber(
                    this._formatCrores(
                        nTotalReceivable
                    )
                );

                this.byId(
                    "accountsReceivableValue"
                ).setUnit(
                    "Cr"
                );

                this.byId(
                    "accountsPayableValue"
                ).setNumber(
                    this._formatCrores(
                        nTotalPayable
                    )
                );

                this.byId(
                    "accountsPayableValue"
                ).setUnit(
                    "Cr"
                );
            },

            _updateTopCustomers(
                aSalesData
            ) {
                const mCustomers = {};

                aSalesData.forEach((oRow) => {
                    const sCustomerKey =
                        oRow.SoldToParty ||
                        "UNKNOWN";

                    if (!mCustomers[sCustomerKey]) {
                        mCustomers[sCustomerKey] = {
                            customer:
                                sCustomerKey,
                            customerName:
                                oRow.SoldToPartyName ||
                                sCustomerKey,
                            salesMT: 0,
                            revenue: 0
                        };
                    }

                    mCustomers[sCustomerKey].salesMT +=
                        this._toNumber(
                            oRow.GrossWeightInKG
                        ) / 1000;

                    mCustomers[sCustomerKey].revenue +=
                        this._toNumber(
                            oRow.NetAmount
                        );
                });

                const aCustomers =
                    Object.values(mCustomers);

                const aTopSales =
                    [...aCustomers]
                        .sort(
                            (oFirst, oSecond) =>
                                oSecond.salesMT -
                                oFirst.salesMT
                        )
                        .slice(0, 4);

                const aTopRevenue =
                    [...aCustomers]
                        .sort(
                            (oFirst, oSecond) =>
                                oSecond.revenue -
                                oFirst.revenue
                        )
                        .slice(0, 4);

                this._updateCustomerPanel(
                    aTopSales,
                    "sales",
                    "salesMT"
                );

                this._updateCustomerPanel(
                    aTopRevenue,
                    "revenue",
                    "revenue"
                );
            },

            _updateCustomerPanel(
                aCustomers,
                sPanelType,
                sMeasure
            ) {
                const aIndexes = [
                    1,
                    2,
                    3,
                    4
                ];

                const nMaximumValue =
                    aCustomers.length > 0
                        ? Math.max(
                            ...aCustomers.map(
                                (oCustomer) =>
                                    Math.abs(
                                        oCustomer[sMeasure]
                                    )
                            ),
                            1
                        )
                        : 1;

                aIndexes.forEach(
                    (iPosition, iArrayIndex) => {
                        const oCustomer =
                            aCustomers[iArrayIndex];

                        const sNameId =
                            `${sPanelType}Customer${iPosition}Name`;

                        const sBarId =
                            `${sPanelType}Customer${iPosition}Bar`;

                        const oNameControl =
                            this.byId(sNameId);

                        const oBarControl =
                            this.byId(sBarId);

                        if (!oNameControl ||
                            !oBarControl) {
                            return;
                        }

                        if (!oCustomer) {
                            oNameControl.setText(
                                "No customer data"
                            );

                            oBarControl.setPercentValue(
                                0
                            );

                            oBarControl.setDisplayValue(
                                "-"
                            );

                            return;
                        }

                        const nMeasureValue =
                            oCustomer[sMeasure];

                        const nPercentage =
                            Math.min(
                                Math.abs(
                                    nMeasureValue
                                ) /
                                    nMaximumValue *
                                    100,
                                100
                            );

                        oNameControl.setText(
                            oCustomer.customerName
                        );

                        oBarControl.setPercentValue(
                            nPercentage
                        );

                        if (sMeasure === "salesMT") {
                            oBarControl.setDisplayValue(
                                `${this._formatNumber(
                                    nMeasureValue,
                                    2
                                )} MT`
                            );
                        } else {
                            oBarControl.setDisplayValue(
                                `₹ ${this._formatCrores(
                                    nMeasureValue
                                )} Cr`
                            );
                        }
                    }
                );
            },

            _updateMonthlyRevenue(
                aSalesData,
                iFiscalYear,
                oCutoffDate
            ) {
                const aFiscalMonths =
                    this._getFiscalMonths(
                        iFiscalYear
                    );

                const mMonthlyRevenue = {};

                aFiscalMonths.forEach(
                    (oFiscalMonth) => {
                        mMonthlyRevenue[
                            oFiscalMonth.key
                        ] = 0;
                    }
                );

                aSalesData.forEach((oRow) => {
                    if (!oRow.BillingDocumentDate) {
                        return;
                    }

                    const oBillingDate =
                        new Date(
                            `${oRow.BillingDocumentDate}T00:00:00`
                        );

                    if (Number.isNaN(
                        oBillingDate.getTime()
                    )) {
                        return;
                    }

                    const sMonthKey =
                        `${oBillingDate.getFullYear()}-${String(
                            oBillingDate.getMonth() + 1
                        ).padStart(2, "0")}`;

                    if (
                        Object.prototype.hasOwnProperty.call(
                            mMonthlyRevenue,
                            sMonthKey
                        )
                    ) {
                        mMonthlyRevenue[sMonthKey] +=
                            this._toNumber(
                                oRow.NetAmount
                            );
                    }
                });

                const nMaximumRevenue =
                    Math.max(
                        ...Object.values(
                            mMonthlyRevenue
                        ).map(
                            (nValue) =>
                                Math.abs(nValue)
                        ),
                        1
                    );

                aFiscalMonths.forEach(
                    (oFiscalMonth) => {
                        const nRevenue =
                            mMonthlyRevenue[
                                oFiscalMonth.key
                            ];

                        const nPercentage =
                            Math.min(
                                Math.abs(nRevenue) /
                                    nMaximumRevenue *
                                    100,
                                100
                            );

                        const oRevenueBar =
                            this.byId(
                                oFiscalMonth.barId
                            );

                        if (oRevenueBar) {
                            oRevenueBar.setPercentValue(
                                nPercentage
                            );

                            oRevenueBar.setDisplayValue(
                                `₹ ${this._formatCrores(
                                    nRevenue
                                )} Cr`
                            );
                        }
                    }
                );

                this._setRevenueMonthVisibility(
                    iFiscalYear,
                    oCutoffDate
                );
            },

            _setLiveDataStatuses() {
                this.byId(
                    "prototypeModeStatus"
                ).setText(
                    "Live Data"
                );

                this.byId(
                    "prototypeModeStatus"
                ).setState(
                    "Success"
                );

                this.byId(
                    "totalSalesStatus"
                ).setText(
                    "Live data"
                );

                this.byId(
                    "totalRevenueStatus"
                ).setText(
                    "Live data"
                );

                this.byId(
                    "accountsReceivableStatus"
                ).setText(
                    "All historical outstanding items"
                );

                this.byId(
                    "accountsPayableStatus"
                ).setText(
                    "All historical outstanding items"
                );

                this.byId(
                    "topCustomersSalesDemoStatus"
                ).setText(
                    "Live data"
                );

                this.byId(
                    "topCustomersRevenueDemoStatus"
                ).setText(
                    "Live data"
                );

                this.byId(
                    "monthlyRevenueDemoStatus"
                ).setText(
                    "Live data"
                );
            },

            _getPeriodEndDate(
                iFiscalYear,
                iPeriod
            ) {
                /*
                 * Fiscal year starts in April.
                 *
                 * April to December belong to the fiscal-year
                 * start year.
                 *
                 * January to March belong to the following
                 * calendar year.
                 */
                const iCalendarYear =
                    iPeriod >= 4
                        ? iFiscalYear
                        : iFiscalYear + 1;

                /*
                 * JavaScript month values are zero-based.
                 * Day zero of the following month gives the
                 * final day of the selected month.
                 */
                return new Date(
                    iCalendarYear,
                    iPeriod,
                    0
                );
            },

            _getFiscalMonths(
                iFiscalYear
            ) {
                return [
                    {
                        key: `${iFiscalYear}-04`,
                        month: 4,
                        year: iFiscalYear,
                        labelId: "monthAprLabel",
                        barId: "monthAprRevenue"
                    },
                    {
                        key: `${iFiscalYear}-05`,
                        month: 5,
                        year: iFiscalYear,
                        labelId: "monthMayLabel",
                        barId: "monthMayRevenue"
                    },
                    {
                        key: `${iFiscalYear}-06`,
                        month: 6,
                        year: iFiscalYear,
                        labelId: "monthJunLabel",
                        barId: "monthJunRevenue"
                    },
                    {
                        key: `${iFiscalYear}-07`,
                        month: 7,
                        year: iFiscalYear,
                        labelId: "monthJulLabel",
                        barId: "monthJulRevenue"
                    },
                    {
                        key: `${iFiscalYear}-08`,
                        month: 8,
                        year: iFiscalYear,
                        labelId: "monthAugLabel",
                        barId: "monthAugRevenue"
                    },
                    {
                        key: `${iFiscalYear}-09`,
                        month: 9,
                        year: iFiscalYear,
                        labelId: "monthSepLabel",
                        barId: "monthSepRevenue"
                    },
                    {
                        key: `${iFiscalYear}-10`,
                        month: 10,
                        year: iFiscalYear,
                        labelId: "monthOctLabel",
                        barId: "monthOctRevenue"
                    },
                    {
                        key: `${iFiscalYear}-11`,
                        month: 11,
                        year: iFiscalYear,
                        labelId: "monthNovLabel",
                        barId: "monthNovRevenue"
                    },
                    {
                        key: `${iFiscalYear}-12`,
                        month: 12,
                        year: iFiscalYear,
                        labelId: "monthDecLabel",
                        barId: "monthDecRevenue"
                    },
                    {
                        key: `${iFiscalYear + 1}-01`,
                        month: 1,
                        year: iFiscalYear + 1,
                        labelId: "monthJanLabel",
                        barId: "monthJanRevenue"
                    },
                    {
                        key: `${iFiscalYear + 1}-02`,
                        month: 2,
                        year: iFiscalYear + 1,
                        labelId: "monthFebLabel",
                        barId: "monthFebRevenue"
                    },
                    {
                        key: `${iFiscalYear + 1}-03`,
                        month: 3,
                        year: iFiscalYear + 1,
                        labelId: "monthMarLabel",
                        barId: "monthMarRevenue"
                    }
                ];
            },

            _setRevenueMonthVisibility(
                iFiscalYear,
                oCutoffDate
            ) {
                const aFiscalMonths =
                    this._getFiscalMonths(
                        iFiscalYear
                    );

                const oNormalizedCutoff =
                    new Date(
                        oCutoffDate.getFullYear(),
                        oCutoffDate.getMonth(),
                        1
                    );

                aFiscalMonths.forEach(
                    (oFiscalMonth) => {
                        const oMonthDate =
                            new Date(
                                oFiscalMonth.year,
                                oFiscalMonth.month - 1,
                                1
                            );

                        const bVisible =
                            oMonthDate <=
                            oNormalizedCutoff;

                        const oLabel =
                            this.byId(
                                oFiscalMonth.labelId
                            );

                        const oRevenueBar =
                            this.byId(
                                oFiscalMonth.barId
                            );

                        if (oLabel) {
                            oLabel.setVisible(
                                bVisible
                            );
                        }

                        if (oRevenueBar) {
                            oRevenueBar.setVisible(
                                bVisible
                            );
                        }
                    }
                );
            },

            _formatDateForOData(
                oDate
            ) {
                const iYear =
                    oDate.getFullYear();

                const sMonth =
                    String(
                        oDate.getMonth() + 1
                    ).padStart(
                        2,
                        "0"
                    );

                const sDay =
                    String(
                        oDate.getDate()
                    ).padStart(
                        2,
                        "0"
                    );

                return `${iYear}-${sMonth}-${sDay}`;
            },

            _toNumber(
                vValue
            ) {
                const nValue =
                    Number(vValue);

                return Number.isFinite(nValue)
                    ? nValue
                    : 0;
            },

            _formatNumber(
                nValue,
                iDecimals = 2
            ) {
                return new Intl.NumberFormat(
                    "en-IN",
                    {
                        minimumFractionDigits:
                            iDecimals,
                        maximumFractionDigits:
                            iDecimals
                    }
                ).format(
                    nValue
                );
            },

            _formatCrores(
                nAmount
            ) {
                const nCrores =
                    nAmount / 10000000;

                return this._formatNumber(
                    nCrores,
                    2
                );
            }
        }
    );
});