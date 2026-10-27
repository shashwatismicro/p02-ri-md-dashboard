sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (
    Controller,
    MessageToast,
    Filter,
    FilterOperator,
    JSONModel
) => {
    "use strict";

    return Controller.extend(
        "com.oswal.managementcockpit.managementcockpit.controller.Dashboard",
        {
            onInit() {
                const oToday = new Date();
                this.getView().setModel(
    new JSONModel({
        customers: []
    }),
    "topSales"
);

this.getView().setModel(
    new JSONModel({
        customers: []
    }),
    "topRevenue"
);

this.getView().setModel(
    new JSONModel({
        months: []
    }),
    "monthlyRevenue"
);
this.getView().setModel(
    new JSONModel({
        buckets: [],
        totalAmountCr: 0,
        totalLabel: "Total AR",
        totalBills: 0
    }),
    "receivablesAgeing"
);

this.getView().setModel(
    new JSONModel({
        buckets: [],
        totalAmountCr: 0,
        totalLabel: "Total AP",
        totalBills: 0
    }),
    "payablesAgeing"
);

this.getView().setModel(
    new JSONModel({
        segments: [],
        totalAmountCr: 0,
        totalLabel: "Total Revenue",
        exportRevenueCr: 0,
        domesticRevenueCr: 0
    }),
    "exportDomesticRevenue"
);

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
                 */
                
                
            },
                        onAfterRendering() {
                if (this._bInitialDashboardLoadStarted) {
                    return;
                }

                this._bInitialDashboardLoadStarted = true;

                const oToday = new Date();

                const iCurrentFiscalYear =
                    oToday.getMonth() + 1 >= 4
                        ? oToday.getFullYear()
                        : oToday.getFullYear() - 1;

                this._loadDashboardData(
                    iCurrentFiscalYear,
                    oToday.getMonth() + 1
                );
            },

            onManagementTabSelect(
    oEvent
) {
    const sSelectedKey =
        oEvent.getParameter("key");

    if (
        sSelectedKey !==
        "production"
    ) {
        return;
    }

    const oProductionView =
        this.byId(
            "productionModuleView"
        );

    if (!oProductionView) {
        console.error(
            "Production module view is not available."
        );
        return;
    }

    const oProductionController =
        oProductionView.getController();

    if (
        !oProductionController ||
        typeof oProductionController
            .loadProductionData !==
            "function"
    ) {
        console.error(
            "Production controller or loadProductionData method is not available."
        );
        return;
    }

    const sSelectedPlant =
        this.byId(
            "plantSelect"
        ).getSelectedKey();

    oProductionController.loadProductionData(
        sSelectedPlant
    );
},

                        async onApplyFilters() {
                const sCompanyCode =
                    this.byId("companyCodeSelect").getSelectedKey();

                const sPlant =
                    this.byId("plantSelect").getSelectedKey();

                const iFiscalYear = Number(
                    this.byId("fiscalYearSelect").getSelectedKey()
                );

                const sPeriod =
                    this.byId("periodSelect").getSelectedKey();

                const oToday = new Date();

                if (sPeriod !== "ALL") {
                    const iPeriod = Number(sPeriod);

                    const oPeriodEndDate =
                        this._getPeriodEndDate(
                            iFiscalYear,
                            iPeriod
                        );

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
                            "Future periods cannot be selected because data is not yet available."
                        );
                        return;
                    }

                    this._setRevenueMonthVisibility(
                        iFiscalYear,
                        oPeriodEndDate
                    );
                } else {
                    const oFiscalYearEnd =
                        this._getFiscalYearEndDate(
                            iFiscalYear
                        );

                    this._setRevenueMonthVisibility(
                        iFiscalYear,
                        oFiscalYearEnd
                    );
                }

                const sPlantText =
                    sPlant === "ALL"
                        ? "All Plants"
                        : sPlant;

                const oSelectedPeriodItem =
                    this.byId("periodSelect").getSelectedItem();

                const sPeriodText =
                    oSelectedPeriodItem
                        ? oSelectedPeriodItem.getText()
                        : sPeriod;

                this.byId("dashboardCompanyText").setText(
                    `Company Code: ${sCompanyCode} | Plant: ${sPlantText} | FY ${iFiscalYear} | Period: ${sPeriodText}`
                );

                /*
                * Selected month:
                * Sales, Revenue and Top Customers use that month only.
                * Month-wise Revenue uses April through the selected month.
                * AR/AP use all historical outstanding items as of month-end.
                *
                * Period All:
                * Sales, Revenue and Top Customers use the complete fiscal year.
                * Month-wise Revenue uses the complete April-March fiscal year.
                * AR/AP use all historical outstanding items as of fiscal-year-end.
                *
                * No accounting-document Fiscal Year filter is applied to AR/AP.
                */
                await this._loadDashboardData(
                    iFiscalYear,
                    sPeriod
                );
            },

async _loadDashboardData(
    iFiscalYear,
    vPeriod
) {
    const oView =
        this.getView();

    const oModel =
        oView.getModel();

    if (!oModel) {
        MessageToast.show(
            "Management Cockpit OData model is not available."
        );
        return;
    }

    /*
     * Every dashboard load receives its own sequence number.
     * If filters change while an older request is still running,
     * results from that older request are ignored.
     */
    this._iDashboardLoadSequence =
        (this._iDashboardLoadSequence || 0) + 1;

    const iLoadSequence =
        this._iDashboardLoadSequence;

    const sCompanyCode =
        this.byId(
            "companyCodeSelect"
        ).getSelectedKey();

    const sPlant =
        this.byId(
            "plantSelect"
        ).getSelectedKey();

    const sPeriod =
        String(vPeriod).padStart(
            2,
            "0"
        );

    const oFiscalYearStart =
        this._getFiscalYearStartDate(
            iFiscalYear
        );

    const oFiscalYearEnd =
        this._getFiscalYearEndDate(
            iFiscalYear
        );

    let oKpiStartDate;
    let oKpiEndDate;
    let oTrendEndDate;
    let oAccountingKeyDate;

    if (sPeriod === "ALL") {
        /*
         * Period All:
         * Sales KPIs, Top Customers and trend use
         * the complete selected fiscal year.
         *
         * AR/AP use all historical outstanding items
         * as of fiscal-year-end.
         */
        oKpiStartDate =
            oFiscalYearStart;

        oKpiEndDate =
            oFiscalYearEnd;

        oTrendEndDate =
            oFiscalYearEnd;

        oAccountingKeyDate =
            oFiscalYearEnd;
    } else {
        const iPeriod =
            Number(sPeriod);

        /*
         * Sales KPIs and Top Customers use
         * the selected month only.
         */
        oKpiStartDate =
            this._getPeriodStartDate(
                iFiscalYear,
                iPeriod
            );

        oKpiEndDate =
            this._getPeriodEndDate(
                iFiscalYear,
                iPeriod
            );

        /*
         * Month-wise Revenue uses fiscal-year
         * start through the selected month.
         */
        oTrendEndDate =
            oKpiEndDate;

        /*
         * AR/AP use all historical outstanding items
         * as of the selected month's final date.
         */
        oAccountingKeyDate =
            oKpiEndDate;
    }

    const sKpiStartDate =
        this._formatDateForOData(
            oKpiStartDate
        );

    const sKpiEndDate =
        this._formatDateForOData(
            oKpiEndDate
        );

    const sFiscalYearStart =
        this._formatDateForOData(
            oFiscalYearStart
        );

    const sTrendEndDate =
        this._formatDateForOData(
            oTrendEndDate
        );

    const sAccountingKeyDate =
        this._formatDateForOData(
            oAccountingKeyDate
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
            sTrendEndDate
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

    /*
     * Only the properties required by the dashboard
     * are requested from the Sales entity.
     */
    const aSelectedSalesProperties = [
        "BillingDocument",
        "BillingDocumentItem",
        "BillingDocumentDate",
        "BillingDocumentType",
        "DocumentReferenceID",
        "SoldToParty",
        "SoldToPartyName",
        "BasicValue",
        "GrossWeightInKG"
    ];

    oView.setBusy(true);

    /*
     * Start Sales, AR and AP requests together.
     * Accounting pagination no longer waits for Sales,
     * and Sales rendering no longer waits for accounting.
     */
    const oSalesPromise =
        this._requestCollection(
            "/Sales",
            aSalesFilters,
            aSelectedSalesProperties
        );

    const oAccountingPromise =
        Promise.all([
            this._requestParameterizedCollection(
                "AccountsReceivable",
                sAccountingKeyDate,
                sCompanyCode,
                sPlant
            ),
            this._requestParameterizedCollection(
                "AccountsPayable",
                sAccountingKeyDate,
                sCompanyCode,
                sPlant
            )
        ]);

    let bSalesLoaded = false;
    let bAccountingLoaded = false;

    try {
        const aTrendSalesRawData =
            await oSalesPromise;

        /*
         * Ignore this result if the user applied
         * another filter selection while it loaded.
         */
        if (
            iLoadSequence !==
            this._iDashboardLoadSequence
        ) {
            return;
        }

        /*
         * Apply the common Management Cockpit
         * Sales eligibility rule once.
         *
         * Excluded:
         * - Billing Type F8
         * - Billing Type JSTO
         * - Billing Type S1 where Reference starts IU
         */
        const aTrendSalesData =
            aTrendSalesRawData.filter(
                (oRow) =>
                    this._isEligibleSalesRow(
                        oRow
                    )
            );

        /*
         * The one Sales request covers April through
         * the selected trend cutoff.
         *
         * For a selected month, derive the KPI-month
         * rows locally.
         *
         * For Period All, the complete eligible
         * fiscal-year array is reused.
         */
        const aKpiSalesData =
            sPeriod === "ALL"
                ? aTrendSalesData
                : aTrendSalesData.filter(
                    (oRow) => {
                        const sBillingDate =
                            String(
                                oRow.BillingDocumentDate ||
                                ""
                            ).substring(
                                0,
                                10
                            );

                        return (
                            sBillingDate >=
                                sKpiStartDate &&
                            sBillingDate <=
                                sKpiEndDate
                        );
                    }
                );

        this._updateSalesAndRevenueKPIs(
            aKpiSalesData
        );

        this._updateTopCustomers(
            aKpiSalesData
        );

        this._updateMonthlyRevenue(
            aTrendSalesData,
            iFiscalYear,
            oTrendEndDate
        );

        this._updateExportDomesticRevenue(
            aKpiSalesData
        );

        bSalesLoaded = true;

        /*
         * Release the page-level busy state as soon
         * as the Sales section is usable.
         *
         * AR/AP continue loading in the background.
         */
        oView.setBusy(false);

        console.info(
            "Sales dashboard data loaded:",
            {
                loadSequence:
                    iLoadSequence,
                rawSalesRows:
                    aTrendSalesRawData.length,
                eligibleTrendRows:
                    aTrendSalesData.length,
                eligibleKpiRows:
                    aKpiSalesData.length,
                excludedRows:
                    aTrendSalesRawData.length -
                    aTrendSalesData.length
            }
        );
    } catch (oSalesError) {
        if (
            iLoadSequence ===
            this._iDashboardLoadSequence
        ) {
            console.error(
                "Management Cockpit Sales loading failed:",
                oSalesError
            );

            MessageToast.show(
                "Sales dashboard data could not be loaded. Check the browser console for details."
            );

            oView.setBusy(false);
        }
    }

    try {
        const [
            aReceivableData,
            aPayableData
        ] =
            await oAccountingPromise;

        /*
         * Do not allow an older filter request
         * to overwrite newer dashboard results.
         */
        if (
            iLoadSequence !==
            this._iDashboardLoadSequence
        ) {
            return;
        }

        this._updateAccountingKPIs(
            aReceivableData,
            aPayableData
        );

        bAccountingLoaded = true;

        console.info(
            "Accounting dashboard data loaded:",
            {
                loadSequence:
                    iLoadSequence,
                receivableRows:
                    aReceivableData.length,
                payableRows:
                    aPayableData.length,
                accountingKeyDate:
                    sAccountingKeyDate
            }
        );
    } catch (oAccountingError) {
        if (
            iLoadSequence ===
            this._iDashboardLoadSequence
        ) {
            console.error(
                "Management Cockpit AR/AP loading failed:",
                oAccountingError
            );

            MessageToast.show(
                "AR/AP data could not be loaded. Sales data may still be available."
            );
        }
    } finally {
        if (
            iLoadSequence ===
            this._iDashboardLoadSequence
        ) {
            oView.setBusy(false);
        }
    }

    if (
        iLoadSequence !==
        this._iDashboardLoadSequence
    ) {
        return;
    }

    if (
        bSalesLoaded &&
        bAccountingLoaded
    ) {
        this._setLiveDataStatuses();

        MessageToast.show(
            "Live Management Cockpit data loaded successfully."
        );
    }
},
            async _requestParameterizedCollection(
    sEntityName,
    sKeyDate,
    sCompanyCode,
    sPlant
) {
    const oModel =
        this.getView().getModel();

    const sServiceRoot =
        new URL(
            oModel.getServiceUrl(),
            window.location.origin
        ).toString();

    const aFilterParts = [
        `CompanyCode eq '${this._escapeODataString(
            sCompanyCode
        )}'`
    ];

    if (sPlant !== "ALL") {
        aFilterParts.push(
            `ProfitCenter eq '${this._escapeODataString(
                sPlant
            )}'`
        );
    }

    const sFilter =
        encodeURIComponent(
            aFilterParts.join(" and ")
        );

    let sRequestUrl =
        new URL(
            `${sEntityName}/${sKeyDate}/Set` +
            `?$filter=${sFilter}`,
            sServiceRoot
        ).toString();

    const aAllResults = [];

    while (sRequestUrl) {
        const oResponse =
            await fetch(
                sRequestUrl,
                {
                    method: "GET",
                    headers: {
                        Accept:
                            "application/json"
                    },
                    credentials:
                        "same-origin"
                }
            );

        if (!oResponse.ok) {
            const sErrorText =
                await oResponse.text();

            throw new Error(
                `${sEntityName} request failed with HTTP ` +
                `${oResponse.status}: ${sErrorText}`
            );
        }

        const oResponseData =
            await oResponse.json();

        if (
            Array.isArray(
                oResponseData.value
            )
        ) {
            aAllResults.push(
                ...oResponseData.value
            );
        }

        const sNextLink =
            oResponseData[
                "@odata.nextLink"
            ] || "";

        sRequestUrl =
            sNextLink
                ? new URL(
                    sNextLink,
                    sServiceRoot
                ).toString()
                : "";
    }

    return aAllResults;
},
_escapeODataString(
    sValue
) {
    return String(sValue).replace(
        /'/g,
        "''"
    );
},

_isEligibleSalesRow(
    oRow
) {
    const sBillingDocumentType =
        String(
            oRow.BillingDocumentType || ""
        ).trim();

    const sDocumentReferenceID =
        String(
            oRow.DocumentReferenceID || ""
        ).trim();

    return !(
        sBillingDocumentType === "F8" ||
        sBillingDocumentType === "JSTO" ||
        (
            sBillingDocumentType === "S1" &&
            sDocumentReferenceID.startsWith("IU")
        )
    );
},

_isExportRevenueRow(
    oRow
) {
    const sBillingDocumentType =
        String(
            oRow.BillingDocumentType || ""
        ).trim();

    const sBillingDocument =
        String(
            oRow.BillingDocument || ""
        ).trim();

    const sDocumentReferenceID =
        String(
            oRow.DocumentReferenceID || ""
        ).trim();

    return (
        (
            sBillingDocumentType === "F2" &&
            sBillingDocument.startsWith("EX")
        ) ||
        (
            sBillingDocumentType === "S1" &&
            sDocumentReferenceID.startsWith("EX")
        )
    );
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
    aFilters = [],
    aSelectedProperties = []
) {
    const oModel =
        this.getView().getModel();

    const mParameters = {
        "$count": true
    };

    if (
        Array.isArray(aSelectedProperties) &&
        aSelectedProperties.length > 0
    ) {
        mParameters.$select =
            aSelectedProperties.join(",");
    }

    const oListBinding =
        oModel.bindList(
            sPath,
            null,
            null,
            aFilters,
            mParameters
        );

    const aAllResults = [];
    const iPageSize = 1000;
    let iStart = 0;
    let bMoreData = true;

    try {
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

            aAllResults.push(
                ...aPageData
            );

            bMoreData =
                aContexts.length ===
                iPageSize;

            iStart += iPageSize;
        }

        return aAllResults;
    } finally {
        oListBinding.destroy();
    }
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
                                oRow.BasicValue
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

            _updateExportDomesticRevenue(
    aSalesData
) {
    const nTotalRevenue =
        aSalesData.reduce(
            (nTotal, oRow) =>
                nTotal +
                this._toNumber(
                    oRow.BasicValue
                ),
            0
        );

    const nExportRevenue =
        aSalesData.reduce(
            (nTotal, oRow) => {
                if (
                    !this._isExportRevenueRow(
                        oRow
                    )
                ) {
                    return nTotal;
                }

                return (
                    nTotal +
                    this._toNumber(
                        oRow.BasicValue
                    )
                );
            },
            0
        );

    const nDomesticRevenue =
        nTotalRevenue -
        nExportRevenue;

    const oRevenueSplitModel =
        this.getView().getModel(
            "exportDomesticRevenue"
        );

    oRevenueSplitModel.setProperty(
        "/segments",
        [
            {
                category: "Export",
                revenueAmount:
                    nExportRevenue,
                revenueCr:
                    Number(
                        (
                            nExportRevenue /
                            10000000
                        ).toFixed(3)
                    )
            },
            {
                category: "Domestic",
                revenueAmount:
                    nDomesticRevenue,
                revenueCr:
                    Number(
                        (
                            nDomesticRevenue /
                            10000000
                        ).toFixed(3)
                    )
            }
        ]
    );

    oRevenueSplitModel.setProperty(
        "/totalAmountCr",
        this._formatCrores(
            nTotalRevenue
        )
    );

    oRevenueSplitModel.setProperty(
        "/totalLabel",
        "Total Revenue"
    );

    oRevenueSplitModel.setProperty(
        "/exportRevenueCr",
        Number(
            (
                nExportRevenue /
                10000000
            ).toFixed(3)
        )
    );

    oRevenueSplitModel.setProperty(
        "/domesticRevenueCr",
        Number(
            (
                nDomesticRevenue /
                10000000
            ).toFixed(3)
        )
    );

    console.info(
        "Revenue split:",
        {
            totalRevenue:
                nTotalRevenue,
            exportRevenue:
                nExportRevenue,
            domesticRevenue:
                nDomesticRevenue,
            reconciliationDifference:
                nTotalRevenue -
                (
                    nExportRevenue +
                    nDomesticRevenue
                )
        }
    );
    this._configureAgeingCharts();
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
     * Signed Due Amount values are summed directly.
     * No sign reversal or absolute-value conversion
     * is applied to the AR/AP KPI totals.
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

    /*
     * Doughnut slice proportions are based on
     * bill counts, not Due Amount values.
     */
    this._updateAgeingModel(
        aReceivableData,
        nTotalReceivable,
        "receivablesAgeing",
        "Total AR"
    );

    this._updateAgeingModel(
        aPayableData,
        nTotalPayable,
        "payablesAgeing",
        "Total AP"
    );
    this._configureAgeingCharts();
},

_updateAgeingModel(
    aAgeingData,
    nTotalAmount,
    sModelName,
    sTotalLabel
) {
    const aBuckets = [
        {
            slab: "0–30 Days",
            minimum: 0,
            maximum: 30,
            billCount: 0
        },
        {
            slab: "31–60 Days",
            minimum: 31,
            maximum: 60,
            billCount: 0
        },
        {
            slab: "61–90 Days",
            minimum: 61,
            maximum: 90,
            billCount: 0
        },
        {
            slab: "91 Days and Above",
            minimum: 91,
            maximum: Number.POSITIVE_INFINITY,
            billCount: 0
        }
    ];

    aAgeingData.forEach((oRow) => {
        const nDueDays =
            Number(oRow.DueDays);

        /*
         * Invalid or negative Due Days records
         * are excluded from the doughnut only.
         * Due Days = 0 is included in 0–30 Days.
         */
        if (
            !Number.isFinite(nDueDays) ||
            nDueDays < 0
        ) {
            return;
        }

        const oMatchingBucket =
            aBuckets.find(
                (oBucket) =>
                    nDueDays >=
                        oBucket.minimum &&
                    nDueDays <=
                        oBucket.maximum
            );

        if (oMatchingBucket) {
            oMatchingBucket.billCount += 1;
        }
    });

    const iTotalBills =
        aBuckets.reduce(
            (iTotal, oBucket) =>
                iTotal +
                oBucket.billCount,
            0
        );

    const aChartBuckets =
        aBuckets.map((oBucket) => ({
            slab: oBucket.slab,
            billCount: oBucket.billCount,
            percentage:
                iTotalBills > 0
                    ? Number(
                        (
                            oBucket.billCount /
                            iTotalBills *
                            100
                        ).toFixed(1)
                    )
                    : 0,
            legendText:
                `${oBucket.slab}: ` +
                `${this._formatNumber(
                    oBucket.billCount,
                    0
                )} bills`
        }));

    const oAgeingModel =
        this.getView().getModel(
            sModelName
        );

    oAgeingModel.setProperty(
        "/buckets",
        aChartBuckets
    );

    oAgeingModel.setProperty(
        "/totalAmountCr",
        this._formatCrores(
            nTotalAmount
        )
    );

    oAgeingModel.setProperty(
        "/totalLabel",
        sTotalLabel
    );

    oAgeingModel.setProperty(
        "/totalBills",
        iTotalBills
    );
},

_configureAgeingCharts() {
    const oReceivablesChart =
        this.byId(
            "receivablesAgeingChart"
        );

    const oPayablesChart =
        this.byId(
            "payablesAgeingChart"
        );

    const oRevenueSplitChart =
        this.byId(
            "exportDomesticRevenueChart"
        );

    const oCommonAgeingProperties = {
        title: {
            visible: false
        },

        legend: {
            visible: true,
            position: "bottom",
            label: {
                visible: true
            }
        },

        plotArea: {
            colorPalette: [
                "#0A6ED1",
                "#2E7D32",
                "#E9730C",
                "#BB0000"
            ],

            dataLabel: {
                visible: true,
                type: "percentage",
                formatString: "0.0%"
            },

            isDonut: true
        },

        interaction: {
            selectability: {
                mode: "NONE"
            }
        }
    };

    const oRevenueSplitProperties = {
        title: {
            visible: false
        },

        legend: {
            visible: true,
            position: "bottom",
            label: {
                visible: true
            }
        },

        plotArea: {
            /*
             * Export = blue
             * Domestic = green
             */
            colorPalette: [
                "#0A6ED1",
                "#2E7D32"
            ],

            dataLabel: {
                visible: true,
                type: "percentage",
                formatString: "0.0%"
            },

            isDonut: true
        },

        interaction: {
            selectability: {
                mode: "NONE"
            }
        }
    };

    if (oReceivablesChart) {
        oReceivablesChart.setVizProperties(
            oCommonAgeingProperties
        );
    }

    if (oPayablesChart) {
        oPayablesChart.setVizProperties(
            oCommonAgeingProperties
        );
    }

    if (oRevenueSplitChart) {
        oRevenueSplitChart.setVizProperties(
            oRevenueSplitProperties
        );
    }
},

            _updateTopCustomers(
    aSalesData
) {
    const mCustomers = {};

    aSalesData.forEach((oRow) => {
        const sCustomerKey =
            oRow.SoldToParty || "UNKNOWN";

        if (!mCustomers[sCustomerKey]) {
            const sCustomerName =
                oRow.SoldToPartyName ||
                sCustomerKey;

            mCustomers[sCustomerKey] = {
                customer: sCustomerKey,
                customerName: sCustomerName,
                customerDisplay:
    this._formatCustomerChartLabel(
        sCustomerKey,
        sCustomerName
    ),
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
                oRow.BasicValue
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
            .slice(0, 4)
            .reverse()
            .map((oCustomer) => ({
                customer:
                    oCustomer.customer,
                customerName:
                    oCustomer.customerName,
                customerDisplay:
                    oCustomer.customerDisplay,
                salesMT:
                    Number(
                        oCustomer.salesMT.toFixed(3)
                    )
            }));

    const aTopRevenue =
        [...aCustomers]
            .sort(
                (oFirst, oSecond) =>
                    oSecond.revenue -
                    oFirst.revenue
            )
            .slice(0, 4)
            .reverse()
            .map((oCustomer) => ({
                customer:
                    oCustomer.customer,
                customerName:
                    oCustomer.customerName,
                customerDisplay:
                    oCustomer.customerDisplay,
                revenueCr:
                    Number(
                        (
                            oCustomer.revenue /
                            10000000
                        ).toFixed(3)
                    )
            }));

    this.getView()
        .getModel("topSales")
        .setProperty(
            "/customers",
            aTopSales
        );

    this.getView()
        .getModel("topRevenue")
        .setProperty(
            "/customers",
            aTopRevenue
        );

    this._configureCustomerCharts();
},

_formatCustomerChartLabel(
    sCustomerCode,
    sCustomerName
) {
    const sCleanName =
        String(sCustomerName || "")
            .replace(/\s+/g, " ")
            .trim();

    const iMaximumFirstLineLength = 34;

    if (
        sCleanName.length <=
        iMaximumFirstLineLength
    ) {
        return `${sCustomerCode} - ${sCleanName}`;
    }

    let iSplitPosition =
        sCleanName.lastIndexOf(
            " ",
            iMaximumFirstLineLength
        );

    if (iSplitPosition <= 0) {
        iSplitPosition =
            iMaximumFirstLineLength;
    }

    const sFirstLine =
        sCleanName
            .substring(
                0,
                iSplitPosition
            )
            .trim();

    const sSecondLine =
        sCleanName
            .substring(
                iSplitPosition
            )
            .trim();

    return (
        `${sCustomerCode} - ${sFirstLine}` +
        `\n${sSecondLine}`
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

        const oBillingDate = new Date(
            `${oRow.BillingDocumentDate}T00:00:00`
        );

        if (
            Number.isNaN(
                oBillingDate.getTime()
            )
        ) {
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
                    oRow.BasicValue
                );
        }
    });

    const oCutoffMonth = new Date(
        oCutoffDate.getFullYear(),
        oCutoffDate.getMonth(),
        1
    );

    const aMonthlyChartData =
        aFiscalMonths
            .filter((oFiscalMonth) => {
                const oFiscalMonthDate =
                    new Date(
                        oFiscalMonth.year,
                        oFiscalMonth.month - 1,
                        1
                    );

                return (
                    oFiscalMonthDate <=
                    oCutoffMonth
                );
            })
            .map((oFiscalMonth) => ({
                monthLabel:
                    this._getMonthLabel(
                        oFiscalMonth.month
                    ),
                revenueCr:
                    Number(
                        (
                            mMonthlyRevenue[
                                oFiscalMonth.key
                            ] / 10000000
                        ).toFixed(3)
                    )
            }));

    this.getView()
        .getModel("monthlyRevenue")
        .setProperty(
            "/months",
            aMonthlyChartData
        );

    this._configureMonthlyRevenueChart();
},

_getMonthLabel(
    iMonth
) {
    const aMonthLabels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];

    return aMonthLabels[
        iMonth - 1
    ];
},

_configureCustomerCharts() {
    const oSalesChart =
        this.byId("topCustomersSalesChart");

    const oRevenueChart =
        this.byId("topCustomersRevenueChart");

    const oCommonProperties = {
    title: {
        visible: false
    },

    legend: {
        visible: false
    },

    plotArea: {
        colorPalette: [
            "#0A6ED1"
        ],

        dataPointSize: {
            min: 16,
            max: 24
        },

        dataLabel: {
            visible: true,
            position: "outside",
            hideWhenOverlap: false
        },

        gridline: {
            visible: true
        }
    },

    categoryAxis: {
        title: {
            visible: false
        },

        label: {
            visible: true
        }
    },

    valueAxis: {
        title: {
            visible: false
        },

        label: {
            visible: true
        }
    },

    interaction: {
        zoom: {
            enableScrolling: false,
            enableZoom: false
        },

        selectability: {
            mode: "NONE"
        }
    }
};

    if (oSalesChart) {
        oSalesChart.setVizProperties({
            ...oCommonProperties,
            valueAxis: {
                title: {
                    visible: true,
                    text: "Sales (MT)"
                },
                label: {
                    visible: true,
                    formatString: "0.000"
                }
            },
            plotArea: {
                ...oCommonProperties.plotArea,
                dataLabel: {
                    visible: true,
                    position: "outside",
                    hideWhenOverlap: false,
                    formatString: "0.000"
                }
            }
        });
    }

    if (oRevenueChart) {
        oRevenueChart.setVizProperties({
            ...oCommonProperties,
            valueAxis: {
                title: {
                    visible: true,
                    text: "Revenue (₹ Cr)"
                },
                label: {
                    visible: true,
                    formatString: "0.000"
                }
            },
            plotArea: {
                ...oCommonProperties.plotArea,
                dataLabel: {
                    visible: true,
                    position: "outside",
                    hideWhenOverlap: false,
                    formatString: "0.000"
                }
            }
        });
    }
},

_configureMonthlyRevenueChart() {
    const oMonthlyRevenueChart =
        this.byId("monthlyRevenueChart");

    if (!oMonthlyRevenueChart) {
        return;
    }

    oMonthlyRevenueChart.setVizProperties({
        title: {
            visible: false
        },
        legend: {
            visible: false
        },
        plotArea: {
            colorPalette: [
                "#0A6ED1"
            ],
            dataLabel: {
                visible: true,
                position: "outside",
                hideWhenOverlap: false,
                formatString: "0.000"
            },
            gridline: {
                visible: true
            }
        },
        categoryAxis: {
            title: {
                visible: false
            },
            label: {
                visible: true
            }
        },
        valueAxis: {
            title: {
                visible: true,
                text: "Revenue (₹ Cr)"
            },
            label: {
                visible: true,
                formatString: "0.000"
            }
        },
        interaction: {
            selectability: {
                mode: "NONE"
            }
        }
    });
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

            _getFiscalYearStartDate(
    iFiscalYear
) {
    return new Date(
        iFiscalYear,
        3,
        1
    );
},

_getFiscalYearEndDate(
    iFiscalYear
) {
    return new Date(
        iFiscalYear + 1,
        3,
        0
    );
},

_getPeriodStartDate(
    iFiscalYear,
    iPeriod
) {
    const iCalendarYear =
        iPeriod >= 4
            ? iFiscalYear
            : iFiscalYear + 1;

    return new Date(
        iCalendarYear,
        iPeriod - 1,
        1
    );
},

            _getPeriodEndDate(
    iFiscalYear,
    iPeriod
) {
    const iCalendarYear =
        iPeriod >= 4
            ? iFiscalYear
            : iFiscalYear + 1;

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